"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { firstFix, rankIssues, type AuditResult, type Fix } from "@/lib/audit";
import type { AuditEvent } from "@/lib/events";
import { normalizeUrl } from "@/lib/url";
import { Arrow, OkaraMark } from "../brand";
import { btn, pill } from "../styles";
import { Checks } from "./checks";
import { CrawlerView } from "./crawler-view";
import { DocsView } from "./docs-view";
import { FixCard } from "./fix-card";
import { Terminal, type TermLine } from "./terminal";

type Phase = "idle" | "running" | "done" | "error";
type Tab = "checks" | "crawlers" | "docs";

const clockMs = () => performance.now();

export function FirstSixty({ initialUrl = "", autoExample = false }: { initialUrl?: string; autoExample?: boolean }) {
  const [value, setValue] = useState(initialUrl);
  // Deep links render the running layout from the server, so nothing jumps when the run starts.
  const [phase, setPhase] = useState<Phase>(autoExample || initialUrl ? "running" : "idle");
  const [lines, setLines] = useState<TermLine[]>([]);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<{ message: string; hint: string; code: string } | null>(null);
  const [inputError, setInputError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [example, setExample] = useState(autoExample);
  const [tab, setTab] = useState<Tab>("checks");
  const [openFix, setOpenFix] = useState<Fix["id"] | null>(null);
  const started = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed(clockMs() - started.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  async function run(opts: { url?: string; example?: boolean }) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setPhase("running");
    setLines([]);
    setResult(null);
    setError(null);
    setInputError("");
    setOpenFix(null);
    setTab("checks");
    setExample(!!opts.example);
    started.current = clockMs();
    setElapsed(0);
    const qs = opts.example ? "?example" : `?url=${encodeURIComponent(opts.url ?? "")}`;
    window.history.replaceState(null, "", qs);

    try {
      const res = await fetch("/api/audit", { method: "POST", body: JSON.stringify(opts), signal: ctl.signal, headers: { "content-type": "application/json" } });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let ended = false;
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AuditEvent;
          if (e.t === "step") {
            setLines((ls) => {
              const i = ls.findIndex((l) => l.id === e.id);
              if (i < 0) return [...ls, e];
              const next = ls.slice();
              next[i] = e;
              return next;
            });
          } else if (e.t === "result") {
            ended = true;
            setElapsed(clockMs() - started.current);
            setResult(e.result);
            setPhase("done");
            requestAnimationFrame(() => resultsRef.current?.focus());
          } else {
            ended = true;
            setElapsed(clockMs() - started.current);
            setError({ message: e.message, hint: e.hint, code: e.code });
            setPhase("error");
          }
        }
      }
      if (!ended) throw new Error("stream ended early");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setElapsed(clockMs() - started.current);
      setError({ code: "network", message: "The connection to the checker dropped.", hint: "Retry, or look at the example meanwhile." });
      setPhase("error");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = normalizeUrl(value);
    if (!n.ok) {
      setInputError(n.reason);
      return;
    }
    run({ url: value });
  }

  // ?url= and ?example deep links start on mount. The timer (cleared on
  // unmount) keeps it to one run under Strict Mode's double mount.
  useEffect(() => {
    if (!autoExample && !initialUrl) return;
    const id = setTimeout(() => run(autoExample ? { example: true } : { url: initialUrl }), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = normalizeUrl(value);
  const fix = result ? firstFix(result) : null;
  const fixCheck = fix && result ? result.checks.find((c) => c.fixId === fix.id && !c.pass) : undefined;
  const topIssue = result ? rankIssues(result.checks)[0] : undefined;
  const unfixable = topIssue && !topIssue.fixId && topIssue.severity === "high" ? topIssue : undefined;
  const others = result && fix ? result.fixes.filter((f) => f.id !== fix.id) : (result?.fixes ?? []);
  const site = result ? (result.example ? "quillmate.example" : result.host.replace(/^www\./, "")) : "";

  function showFix(id: Fix["id"]) {
    if (id === fix?.id) {
      document.getElementById("first-fix")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setOpenFix(id);
    requestAnimationFrame(() => document.getElementById(`fix-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="relative">
      <div className="pixel-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]" aria-hidden="true" />
      <section className={`relative mx-auto max-w-3xl px-4 text-center sm:px-6 ${phase === "idle" ? "pt-16 sm:pt-24" : "pt-10"}`}>
        {phase === "idle" && (
          <div className="mb-6 flex flex-col items-center">
            <span className="mb-3 rounded-lg border border-line bg-popover px-3 py-1.5 text-[12px] leading-4 text-muted">
              <span className="font-semibold text-text">Concept</span> · the first 60 seconds
            </span>
            <OkaraMark className="h-12 w-auto text-text" />
          </div>
        )}
        <h1 className={`display ${phase === "idle" ? "text-[28px] leading-9 sm:text-4xl sm:leading-10" : "text-2xl leading-8 sm:text-[28px] sm:leading-9"}`}>
          {phase === "idle" ? "See what your AI CMO finds before you sign up" : "Your AI CMO, first minute"}
        </h1>
        {phase === "idle" && (
          <p className="mx-auto mt-3 max-w-xl text-lg leading-7 text-muted">
            Paste your website. Real checks on your live site in seconds, and the one fix that matters most, drafted and ready to review.
          </p>
        )}

        <form onSubmit={submit} className="mx-auto mt-6 max-w-xl text-left" noValidate>
          <label htmlFor="site" className="sr-only">
            Your website
          </label>
          <div className="relative flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:rounded-full min-[420px]:border min-[420px]:border-line min-[420px]:bg-card min-[420px]:focus-within:border-muted">
            <input
              id="site"
              name="site"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="Enter your website"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setInputError("");
              }}
              aria-invalid={!!inputError}
              aria-describedby="site-help"
              className="h-[54px] w-full rounded-full border border-line bg-card px-5 text-base text-text outline-none placeholder:text-muted focus:border-muted min-[420px]:border-0 min-[420px]:bg-transparent min-[420px]:pr-36"
            />
            <button type="submit" className={`${btn("primary")} min-[420px]:absolute min-[420px]:right-1.5`} disabled={phase === "running" || !value.trim()}>
              {phase === "running" ? "Checking…" : "Check my site"} <Arrow />
            </button>
          </div>
          <p id="site-help" className={`mt-2 px-5 text-[13px] leading-5 ${inputError ? "text-red" : "text-muted"}`} role={inputError ? "alert" : undefined}>
            {inputError ||
              (value.trim() && preview.ok
                ? `We'll read ${preview.display}${preview.changed.length ? ` (${preview.changed.join(", ")})` : ""}.`
                : "Paste it however you like: with https://, www or a path. Free, no sign-up.")}
          </p>
        </form>
        {phase === "idle" && (
          <p className="mt-4 text-[14px] text-muted">
            No site handy?{" "}
            <button type="button" className="link" onClick={() => run({ example: true })}>
              Run the example
            </button>
          </p>
        )}
      </section>

      <div aria-live="polite" className="sr-only">
        {phase === "running" ? "Checking your site." : phase === "done" && result ? `${result.counts.pass} of ${result.counts.total} checks pass.${fix ? ` First fix: ${fix.title}.` : " Nothing urgent."}` : ""}
      </div>

      {phase !== "idle" && (
        <div className="relative mx-auto mt-10 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Terminal lines={lines} state={phase === "error" ? "error" : phase === "done" ? "done" : "running"} elapsed={elapsed} example={example} />
            <p className="mt-3 min-h-10 px-1 text-[13px] leading-5 text-muted">
              {phase === "done" && result && (
                <>
                  {fix ? "First fix ready" : "All checks done"} in <span className="font-semibold text-text">{(elapsed / 1000).toFixed(1)}s</span>. Okara&apos;s full setup keeps going in the background.
                </>
              )}
            </p>
          </div>

          <div className="min-w-0">
            {phase === "running" && (
              <div className="min-h-[85vh]">
                <div className="rounded-2xl border border-line bg-popover p-6 text-muted">
                  <p>Reading your site. The first findings appear here in a few seconds.</p>
                </div>
              </div>
            )}

            {phase === "error" && error && (
              <div role="alert" className="rounded-2xl border border-red/40 bg-popover p-6">
                <p className="display text-xl">{error.message}</p>
                <p className="mt-2 text-[15px] leading-6 text-muted">{error.hint}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {!example && (
                    <button type="button" className={btn("primary")} onClick={() => run({ url: value })}>
                      Retry now
                    </button>
                  )}
                  <button type="button" className={btn("outline")} onClick={() => run({ example: true })}>
                    Run the example instead
                  </button>
                </div>
                <p className="mt-4 text-[13px] text-dim">Nothing is still running in the background. The terminal shows exactly where it stopped.</p>
              </div>
            )}

            {phase === "done" && result && (
              <div className="rise">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 ref={resultsRef} tabIndex={-1} className="display text-2xl outline-none">
                    {result.page.name}
                  </h2>
                  <p className="text-[15px] text-muted">
                    <span className="font-semibold text-text">
                      {result.counts.pass} of {result.counts.total}
                    </span>{" "}
                    checks pass{result.example && " · example site"}
                  </p>
                </div>

                {unfixable && (
                  <div className="mt-4 rounded-2xl border border-red/40 bg-popover p-5">
                    <p className="eyebrow">Biggest issue · needs a developer</p>
                    <p className="mt-2 font-semibold text-text">{unfixable.label}</p>
                    <p className="mt-1 text-[15px] leading-6 text-muted">
                      {unfixable.detail} {unfixable.why}
                    </p>
                    {fix && <p className="mt-2 text-[13px] text-dim">The agent can&apos;t patch this one. Below is the most important change it can draft.</p>}
                  </div>
                )}

                <div id="first-fix" className="mt-4 scroll-mt-4">
                  {fix ? <FixCard fix={fix} check={fixCheck} site={site} /> : !unfixable && <AllClear r={result} />}
                </div>

                {others.length > 0 && (
                  <section aria-labelledby="also" className="mt-6">
                    <h3 id="also" className="eyebrow">
                      Also drafted ({others.length})
                    </h3>
                    <div className="mt-3 space-y-2">
                      {others.map((f) => (
                        <details
                          key={f.id}
                          id={`fix-${f.id}`}
                          open={openFix === f.id}
                          onToggle={(e) => {
                            const open = (e.target as HTMLDetailsElement).open;
                            if (open !== (openFix === f.id)) setOpenFix(open ? f.id : null);
                          }}
                          className="scroll-mt-4 rounded-2xl border border-line bg-popover"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
                            <span className="font-semibold">{f.title}</span>
                            <span className="text-[13px] text-muted">{f.agent} agent</span>
                          </summary>
                          <div className="px-2 pb-2">
                            <FixCard fix={f} check={result.checks.find((c) => c.fixId === f.id && !c.pass)} site={site} compact />
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                )}

                <div role="tablist" aria-label="Details" className="mt-10 flex flex-wrap gap-2">
                  {(
                    [
                      ["checks", `All ${result.counts.total} checks`],
                      ["crawlers", "How AI assistants see you"],
                      ["docs", "Strategy docs"],
                    ] as [Tab, string][]
                  ).map(([id, label]) => (
                    <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={pill(tab === id)} onClick={() => setTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-5">
                  {tab === "checks" && <Checks checks={result.checks} fixes={result.fixes} onShowFix={showFix} />}
                  {tab === "crawlers" && <CrawlerView r={result} />}
                  {tab === "docs" && <DocsView docs={result.docs} />}
                </div>

                <div className="mt-12 rounded-2xl border border-line bg-card p-6 text-center">
                  <p className="display text-xl">Keep this agent running on {site}</p>
                  <p className="mx-auto mt-2 max-w-md text-[15px] leading-6 text-muted">
                    In Okara, this is the moment you sign up: your fix is already drafted, and the agents pick up from here every day.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <a href="https://okara.ai" className={btn("primary")}>
                      Start free on okara.ai <Arrow />
                    </a>
                    <Link href="/teardown" className={btn("outline")}>
                      Why I&apos;d ship this first
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AllClear({ r }: { r: AuditResult }) {
  const next = r.docs.find((d) => d.file === "content-strategy.md")?.sections[1]?.body ?? [];
  return (
    <article className="rounded-2xl border border-aqua/30 bg-card p-5 sm:p-6">
      <p className="eyebrow">Nothing urgent</p>
      <h3 className="display mt-2 text-2xl leading-8">Your site is in good shape for search and AI answers</h3>
      <p className="mt-2 text-[15px] leading-6 text-muted">
        Every check the agent can fix already passes, so there&apos;s nothing to patch. The work from here is getting noticed. Here&apos;s what your agents would draft first:
      </p>
      <ol className="mt-4 space-y-2">
        {next.map((n, i) => (
          <li key={n} className="flex gap-3 rounded-xl border border-line bg-popover px-4 py-3 text-[15px] leading-6">
            <span className="font-mono text-[13px] text-muted">{i + 1}</span>
            <span>{n}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
