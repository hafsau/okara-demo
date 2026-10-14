/*
 * POST { url } or { example: true } → NDJSON stream of AuditEvents.
 * Every network step sends "start" before it begins and "done" or "warn"
 * when it ends, with real timings, so the screen never waits silently.
 * Every stream ends with a "result" or an "error".
 */
import { audit, findPrices, parsePage } from "@/lib/audit";
import { ERROR_HINTS, type AuditEvent, type StepId } from "@/lib/events";
import { EXAMPLE } from "@/lib/example";
import { FetchError, fetchText, readCapped, safeFetch } from "@/lib/safe-fetch";
import { normalizeUrl } from "@/lib/url";
import { allow, cached, remember } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 20;

const enc = new TextEncoder();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  let body: { url?: string; example?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const stream = new ReadableStream({
    async start(controller) {
      const t0 = performance.now();
      const since = () => Math.round(performance.now() - t0);
      let open = true;
      const send = (e: AuditEvent) => {
        if (!open || req.signal.aborted) return;
        controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      };
      const close = () => {
        if (open) controller.close();
        open = false;
      };
      const step = (id: StepId, status: "start" | "done" | "warn", label: string, detail?: string) => send({ t: "step", id, status, label, detail, ms: since() });
      const fail = (code: string, message: string) => {
        send({ t: "error", code, message, hint: ERROR_HINTS[code] ?? "" });
        close();
      };

      try {
        if (body.example) {
          // No network to wait on, so the example is paced to be readable. Live runs show real timings.
          const result = audit({ url: EXAMPLE.url, html: EXAMPLE.html, robots: { status: "ok", text: EXAMPLE.robots }, llms: EXAMPLE.llms, example: true });
          const blocked = result.robots.bots.filter((b) => b.tier === "search" && !b.allowed).length;
          const paced: [StepId, "done" | "warn", string, string, number][] = [
            ["read", "done", `Reading ${EXAMPLE.display}`, "Bundled example, paced so you can follow it", 150],
            ["fetch", "done", "Fetched the homepage", `${(EXAMPLE.html.length / 1024).toFixed(1)} KB of HTML`, 350],
            ["robots", blocked ? "warn" : "done", "Read robots.txt", blocked ? `${blocked} AI search crawler${blocked > 1 ? "s" : ""} blocked` : "AI search crawlers allowed", 250],
            ["llms", result.llms.found ? "done" : "warn", "Looked for llms.txt", result.llms.found ? "Found" : "Not found", 200],
            ["checks", "done", `Ran ${result.counts.total} checks`, `${result.counts.pass} pass`, 150],
          ];
          for (const [id, status, label, detail, ms] of paced) {
            step(id, "start", label);
            await wait(ms);
            step(id, status, label, detail);
          }
          send({ t: "result", result, ms: since() });
          return close();
        }

        const n = normalizeUrl(String(body.url ?? ""));
        if (!n.ok) return fail("invalid", n.reason);
        step("read", "done", `Reading ${n.display}`, n.changed.length ? `Cleaned up: ${n.changed.join(", ")}` : undefined);

        const hit = cached(n.host);
        if (hit) {
          step("checks", "done", `Ran ${hit.counts.total} checks`, "From a check in the last 10 minutes");
          send({ t: "result", result: hit, ms: since(), cached: true });
          return close();
        }
        const gate = allow(ip);
        if (gate !== "ok") return fail(gate, gate === "rate" ? "Too many checks in a minute." : "Daily limit reached.");

        step("fetch", "start", "Fetching the homepage");
        const { res, finalUrl, timeout } = await safeFetch(n.url, { signal: req.signal });
        if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
          await res.body?.cancel();
          throw new FetchError("blocked", `The site answered ${res.status} to an automated visitor.`, res.status);
        }
        if (!res.ok) {
          await res.body?.cancel();
          throw new FetchError("status", `The site answered ${res.status}.`, res.status);
        }
        const type = res.headers.get("content-type") ?? "";
        if (type && !/html/i.test(type)) {
          await res.body?.cancel();
          throw new FetchError("not_html", `That address returns ${type.split(";")[0]}, not a web page.`);
        }
        const { text: html, bytes, truncated } = await readCapped(res, timeout);
        const headers = Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v]));
        const moved = new URL(finalUrl).host !== new URL(n.url).host ? ` · redirected to ${new URL(finalUrl).host}` : "";
        step("fetch", "done", "Fetched the homepage", `${truncated ? "First 4 MB" : `${Math.max(1, Math.round(bytes / 1024))} KB`} of HTML${moved}`);

        const origin = new URL(finalUrl).origin;
        const quick = parsePage(html, finalUrl);
        step("robots", "start", "Reading robots.txt");
        step("llms", "start", "Looking for llms.txt");
        if (!quick.prices.length && quick.pricingHref) step("pricing", "start", "Reading your pricing page");
        const [robots, llms, pricingHtml] = await Promise.all([
          fetchText(`${origin}/robots.txt`, req.signal),
          fetchText(`${origin}/llms.txt`, req.signal),
          !quick.prices.length && quick.pricingHref ? readPricing(quick.pricingHref, req.signal) : Promise.resolve(null),
        ]);

        const result = audit({
          url: finalUrl,
          html,
          robots,
          llms: llms.status === "ok" ? llms.text : null,
          info: { headers, pricingPagePrices: pricingHtml ? findPrices(parsePage(pricingHtml, quick.pricingHref).text.replace(/\n/g, " ")) : undefined },
        });

        const blocked = result.robots.bots.filter((b) => b.tier === "search" && !b.allowed).length;
        step(
          "robots",
          robots.status === "unreadable" || blocked || result.robots.blocksAll ? "warn" : "done",
          "Read robots.txt",
          robots.status === "missing" ? "None, so every crawler is allowed"
          : robots.status === "unreadable" ? "Didn't load, so crawler access is unknown"
          : result.robots.blocksAll ? "Blocks every crawler"
          : blocked ? `${blocked} AI search crawler${blocked > 1 ? "s" : ""} blocked` : "AI search crawlers allowed",
        );
        step("llms", result.llms.found ? "done" : "warn", "Looked for llms.txt", result.llms.found ? `Found, ${result.llms.lines} lines` : "Not found");
        if (!quick.prices.length && quick.pricingHref) {
          step("pricing", pricingHtml ? "done" : "warn", "Read your pricing page", pricingHtml ? `${result.checks.find((c) => c.id === "pricing")?.pass ? "Found prices" : "No prices in the HTML"}` : "Didn't load");
        }

        if (result.page.words < 15 && !result.page.title) return fail("empty", "There's almost no text in this page's HTML.");
        step("checks", "done", `Ran ${result.counts.total} checks`, `${result.counts.pass} pass`);
        remember(n.host, result);
        send({ t: "result", result, ms: since() });
        close();
      } catch (e) {
        if (req.signal.aborted) return close();
        if (e instanceof FetchError) return fail(e.code, e.message);
        console.error("audit failed", e);
        fail("internal", "The check failed unexpectedly.");
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readPricing(href: string, signal: AbortSignal) {
  try {
    const { res, timeout } = await safeFetch(href, { timeoutMs: 4000, signal });
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) {
      await res.body?.cancel();
      return null;
    }
    return (await readCapped(res, timeout)).text;
  } catch {
    return null;
  }
}
