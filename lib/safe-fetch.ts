/*
 * Fetching arbitrary URLs from a server is an SSRF risk. Each hop is
 * checked: http(s) only, default ports, every resolved address must be
 * public, at most 3 redirects, one overall timeout, and only the first
 * 4 MB of a body is read.
 *
 * Threat model, stated plainly: the address is checked at DNS time and
 * fetch() resolves again when it connects, so a DNS-rebinding attacker could
 * still race it. On Vercel's isolated functions there's no internal network
 * worth reaching, and the route only reads the site root, robots.txt,
 * llms.txt and one pricing page. Pinning the IP with a custom undici
 * dispatcher is the next step if this ever runs inside a real network.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export type FetchCode = "dns" | "private" | "timeout" | "status" | "blocked" | "too_large" | "not_html" | "redirects" | "network";

export class FetchError extends Error {
  constructor(
    public code: FetchCode,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export const USER_AGENT = "Mozilla/5.0 (compatible; First60Concept/0.2; concept demo by Hafsa Usmani; +https://hafsausmani.com)";
const MAX_BYTES = 4_000_000;

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2002::", 16], ["2001:db8::", 32],
] as const) blocked.addSubnet(addr, prefix, "ipv6");

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return blocked.check(ip, "ipv4");
  if (!net.isIPv6(ip)) return true;
  const v = ip.toLowerCase();
  // IPv4-mapped, in dotted or hex form (::ffff:10.0.0.1, ::ffff:a00:1).
  const mapped = v.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (mapped) {
    if (mapped[1]) return isPrivateIp(mapped[1]);
    const hi = parseInt(mapped[2], 16);
    const lo = parseInt(mapped[3], 16);
    return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return blocked.check(v, "ipv6");
}

function withSignal<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function assertPublic(url: URL, signal: AbortSignal) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("private", "Only http and https can be read.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchError("private", "Only standard ports can be read.");
  let addrs: { address: string }[];
  try {
    addrs = await withSignal(lookup(url.hostname, { all: true }), signal);
  } catch (e) {
    if (signal.aborted) throw e;
    throw new FetchError("dns", `${url.hostname} doesn't resolve to a live website.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new FetchError("private", "That address points to a private network, so it can't be read.");
  }
}

const isAbort = (e: unknown) => (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";

export async function safeFetch(start: string, opts: { accept?: string; timeoutMs?: number; signal?: AbortSignal } = {}) {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(opts.signal ? [opts.signal] : [])]);
  const timeout = () => new FetchError("timeout", `The site took more than ${timeoutMs / 1000} seconds to answer.`);
  let url = new URL(start);
  try {
    for (let hop = 0; hop <= 3; hop++) {
      await assertPublic(url, signal);
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "text/html,application/xhtml+xml" },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        url = new URL(location, url);
        continue;
      }
      return { res, finalUrl: url.toString(), signal, timeout };
    }
  } catch (e) {
    if (e instanceof FetchError) throw e;
    if (isAbort(e)) throw timeout();
    throw new FetchError("network", "The site couldn't be reached.");
  }
  throw new FetchError("redirects", "The site redirected more than 3 times.");
}

/** Reads at most 4 MB. Modern pages inline megabytes of app data; the head and copy come first, so a truncated read still audits fine. */
export async function readCapped(res: Response, onAbort: () => FetchError = () => new FetchError("timeout", "The site stopped responding.")) {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", bytes: 0, truncated: false };
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (bytes + value.byteLength > MAX_BYTES) {
        chunks.push(value.subarray(0, MAX_BYTES - bytes));
        bytes = MAX_BYTES;
        truncated = true;
        await reader.cancel();
        break;
      }
      bytes += value.byteLength;
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw isAbort(e) ? onAbort() : new FetchError("network", "The connection dropped while reading the page.");
  }
  const all = new Uint8Array(bytes);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.byteLength;
  }
  const charset = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1];
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset ?? "utf-8");
  } catch {
    decoder = new TextDecoder();
  }
  return { text: decoder.decode(all), bytes, truncated };
}

export type TextFile = { status: "ok"; text: string } | { status: "missing" } | { status: "unreadable" };

/** Fetch a small text file like robots.txt. 404 means missing; anything else that fails means unreadable. */
export async function fetchText(url: string, signal?: AbortSignal): Promise<TextFile> {
  try {
    const { res } = await safeFetch(url, { accept: "text/plain,*/*", timeoutMs: 4000, signal });
    if (res.status === 404 || res.status === 410) return { status: "missing" };
    if (!res.ok) return { status: "unreadable" };
    const type = res.headers.get("content-type") ?? "";
    const { text } = await readCapped(res);
    if (/html/i.test(type) || /^\s*</.test(text)) return { status: "missing" }; // a soft-404 page
    return { status: "ok", text };
  } catch {
    return { status: "unreadable" };
  }
}
