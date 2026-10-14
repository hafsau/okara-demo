/*
 * Best-effort abuse controls for a public demo that fetches other people's
 * sites: per-IP rate limit, a per-host cache and a daily cap. In memory, so
 * per serverless instance; a Vercel Firewall rate-limit rule is the real
 * backstop in production.
 */
import type { AuditResult } from "./audit";

const PER_MINUTE = 6;
const DAILY = 1500;
const CACHE_MS = 10 * 60_000;

const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; result: AuditResult }>();
let day = { key: "", count: 0 };

export function allow(ip: string, now = Date.now()): "ok" | "rate" | "busy" {
  const today = new Date(now).toISOString().slice(0, 10);
  if (day.key !== today) day = { key: today, count: 0 };
  if (day.count >= DAILY) return "busy";
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return "rate";
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  day.count++;
  return "ok";
}

export function cached(host: string, now = Date.now()) {
  const c = cache.get(host);
  return c && now - c.at < CACHE_MS ? c.result : null;
}

export function remember(host: string, result: AuditResult, now = Date.now()) {
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(host, { at: now, result });
}
