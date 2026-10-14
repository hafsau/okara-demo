/*
 * Accept whatever people paste. Okara's docs reject "www." and "https://"
 * (docs/guides/cmo-setup-guide), which is the first wall a new user can hit.
 * Here anything URL-shaped is cleaned up, and the person sees what we'll read.
 */

export type Normalized =
  | { ok: true; url: string; host: string; display: string; changed: string[] }
  | { ok: false; reason: string };

const HOST = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export function normalizeUrl(raw: string): Normalized {
  let s = raw.trim();
  if (!s) return { ok: false, reason: "Paste your website, like yourproduct.com." };
  if (/\s/.test(s)) return { ok: false, reason: "That has a space in it. Paste just the address." };
  if (/^[^/]+@[^/]+\.[a-z]+$/i.test(s)) return { ok: false, reason: "That looks like an email. Paste your website instead." };

  const changed: string[] = [];
  const scheme = s.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (scheme) {
    if (!/^https?$/i.test(scheme[1])) return { ok: false, reason: "Only http and https websites can be read." };
    changed.push(`removed ${scheme[1].toLowerCase()}://`);
    s = s.slice(scheme[0].length);
  }

  let u: URL;
  try {
    u = new URL(`https://${s}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a website address." };
  }
  if (u.username || u.password) return { ok: false, reason: "Remove the login details from the address." };
  if (u.port && u.port !== "443" && u.port !== "80") return { ok: false, reason: "Use your public site, not a dev server port." };

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) {
    return { ok: false, reason: "Use your public website, not a local or IP address." };
  }
  if (!HOST.test(host)) return { ok: false, reason: "That doesn't look like a website address." };

  // Only the homepage is read: it's what onboarding needs, and it keeps the
  // demo from being a general-purpose fetcher.
  const path = u.pathname.replace(/\/+$/, "");
  if (path) changed.push(`reading the homepage, not ${path}`);
  if (u.search) changed.push("dropped the query string");
  if (u.hash) changed.push("dropped the #fragment");

  return {
    ok: true,
    url: `https://${host}/`,
    host,
    display: host.replace(/^www\./, ""),
    changed,
  };
}
