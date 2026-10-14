/*
 * Rule-based site audit. Pure functions over fetched HTML, response headers,
 * robots.txt and llms.txt, so every result is reproducible and unit-tested.
 * No model calls: the point is that a new user sees something true about
 * their own site in seconds, before any paywall, at zero marginal cost.
 */
import { parse } from "node-html-parser";
import { strategyDocs, type StrategyDoc } from "./docs";

export type Severity = "high" | "medium" | "low";
export type Group = "seo" | "ai";
export type Tier = "search" | "user" | "training";

export type Fix = {
  id: "meta" | "og" | "jsonld" | "llms" | "robots";
  title: string;
  agent: "SEO" | "GEO" | "Coding";
  /** Where the change goes, in plain words. */
  where: string;
  lang: "html" | "text" | "diff";
  code: string;
  /** What a person should check before shipping it. */
  review: string;
  /** The Okara free tool that already does this job on its own. */
  tool: { name: string; href: string };
};

export type Check = {
  id: string;
  group: Group;
  severity: Severity;
  pass: boolean;
  /** Couldn't be checked (e.g. robots.txt unreadable). Not counted either way. */
  unknown?: boolean;
  label: string;
  /** What we saw on this site, in plain words. */
  detail: string;
  /** The exact thing we saw: a tag, a robots.txt line, a count. */
  evidence?: string;
  /** Why it matters, one line. */
  why: string;
  fixId?: Fix["id"];
};

/*
 * Crawler tiers, from each provider's crawler docs (checked October 2026).
 * Blocking the training tier is a legitimate choice and never fails a check;
 * blocking the search tier keeps a site out of AI answers.
 */
export const AI_BOTS: { ua: string; who: string; tier: Tier }[] = [
  { ua: "OAI-SearchBot", who: "ChatGPT search", tier: "search" },
  { ua: "Claude-SearchBot", who: "Claude search", tier: "search" },
  { ua: "PerplexityBot", who: "Perplexity answers", tier: "search" },
  { ua: "Googlebot", who: "Google Search and AI Overviews", tier: "search" },
  { ua: "Bingbot", who: "Bing and Copilot", tier: "search" },
  { ua: "ChatGPT-User", who: "ChatGPT opening a link for someone", tier: "user" },
  { ua: "Claude-User", who: "Claude opening a link for someone", tier: "user" },
  { ua: "Perplexity-User", who: "Perplexity opening a link for someone", tier: "user" },
  { ua: "GPTBot", who: "OpenAI model training", tier: "training" },
  { ua: "ClaudeBot", who: "Anthropic model training", tier: "training" },
  { ua: "Google-Extended", who: "Gemini training and grounding (a control token, not a crawler)", tier: "training" },
  { ua: "Applebot-Extended", who: "Apple AI training (control token)", tier: "training" },
  { ua: "CCBot", who: "Common Crawl, used by many model trainers", tier: "training" },
  { ua: "Meta-ExternalAgent", who: "Meta AI training", tier: "training" },
];

export type BotAccess = { ua: string; who: string; tier: Tier; allowed: boolean; line?: number; rule?: string; ownGroup: boolean };

export type RobotsFacts = {
  status: "ok" | "missing" | "unreadable";
  blocksAll: boolean;
  bots: BotAccess[];
  sitemaps: string[];
  contentSignal?: string;
};

export type LlmsFacts = { found: boolean; lines: number };

export type PageFacts = {
  url: string;
  name: string;
  title: string;
  description: string;
  h1s: string[];
  h2s: string[];
  lang: string;
  canonical: string;
  og: { title: string; description: string; image: string; siteName: string };
  twitterCard: string;
  jsonLdTypes: string[];
  images: number;
  imagesWithAlt: number;
  robotsMeta: string;
  words: number;
  spaShell: boolean;
  /** Visible text, one block per line. */
  text: string;
  /** Body-copy paragraphs, for quoting the site's voice. */
  paragraphs: string[];
  firstParagraph: string;
  prices: string[];
  integrations: string[];
  proof: string[];
  audience: string;
  ctas: string[];
  social: string[];
  pricingHref: string;
  links: { text: string; href: string }[];
  template: string;
};

export type FetchInfo = {
  headers?: Record<string, string>;
  /** Prices found on a linked /pricing page, if one was read. */
  pricingPagePrices?: string[];
};

export type AuditResult = {
  url: string;
  host: string;
  example: boolean;
  fetchedAt: string;
  page: Omit<PageFacts, "text" | "links" | "paragraphs">;
  /** The first ~700 characters an HTML-only crawler reads. */
  excerpt: string;
  robots: RobotsFacts;
  llms: LlmsFacts;
  checks: Check[];
  fixes: Fix[];
  docs: StrategyDoc[];
  notes: string[];
  counts: { pass: number; total: number };
};

const KNOWN_INTEGRATIONS = [
  "Slack", "Stripe", "Shopify", "HubSpot", "Salesforce", "Zapier", "Notion", "Google Sheets", "Google Drive",
  "QuickBooks", "Xero", "GitHub", "GitLab", "Jira", "Figma", "WordPress", "Webflow", "Gmail", "Outlook",
  "Zoom", "Intercom", "Segment", "Airtable", "Linear", "Discord", "Microsoft Teams", "Mailchimp", "PayPal",
  "Calendly", "Asana", "Trello", "Vercel", "Supabase", "Framer", "Wix", "Squarespace",
];

const CTA_WORDS = /^(start|get|try|sign up|join|book|request|buy|create|see|watch|download|talk|contact|schedule)\b/i;
const TEMPLATE = /Lovable Generated Project|Generated by create next app|Create Next App|Vite \+ React(?: \+ TS)?|^React App$|Welcome to Nuxt|My Webflow Site|^Untitled$/i;

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function parsePage(rawHtml: string, url: string): PageFacts {
  // Minified HTML puts tags back to back ("<a>Pricing</a><a>Docs</a>"); give text nodes room.
  const html = rawHtml.replace(/>(?=<)/g, "> ");
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  const meta = (sel: string) => clean(root.querySelector(sel)?.getAttribute("content"));
  const origin = new URL(url).origin;

  const jsonLdTypes: string[] = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collectTypes(JSON.parse(s.text || s.innerHTML), jsonLdTypes);
    } catch {
      jsonLdTypes.push("(invalid JSON-LD)");
    }
  }
  const spaShell =
    /<div[^>]+id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/i.test(rawHtml) || /gptengineer|lovable\.(?:dev|app)\/[^"']*\.js/i.test(rawHtml);

  const body = root.querySelector("body") ?? root;
  for (const el of body.querySelectorAll("script, style, noscript, svg, template")) el.remove();
  const text = (body.structuredText ?? body.text)
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .join("\n");
  const flat = text.replace(/\n/g, " ");
  const words = flat ? flat.split(/\s+/).length : 0;

  const images = body.querySelectorAll("img");
  const h1s = body.querySelectorAll("h1").map((h) => clean(h.text)).filter(Boolean);
  const h2s = uniq(body.querySelectorAll("h2").map((h) => clean(h.text)).filter((t) => t && t.length <= 90));
  const paragraphs = uniq(
    body
      .querySelectorAll("p")
      .map((p) => clean(p.text))
      .filter((t) => t.length >= 40 && t.length <= 400 && !/cookie|javascript|©/i.test(t)),
  ).slice(0, 60);
  const firstParagraph = paragraphs.find((t) => t.length >= 60) ?? "";

  const anchors = body.querySelectorAll("a[href]").map((a) => ({ text: clean(a.text), href: absolute(a.getAttribute("href") ?? "", url) }));
  const links = anchors
    .filter((l) => l.text && l.text.length <= 30 && l.href.startsWith(origin) && l.href !== origin && !l.href.includes("#"))
    .filter((l, i, all) => all.findIndex((m) => m.href === l.href) === i)
    .slice(0, 10);
  const social = uniq(
    anchors.map((a) => a.href).filter((h) => /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com|linkedin\.com|github\.com|youtube\.com|instagram\.com)\/[^/]+/i.test(h)),
  ).slice(0, 5);
  const pricingHref = anchors.find((a) => /^pricing$|^plans( & pricing)?$/i.test(a.text) && a.href.startsWith(origin))?.href ?? "";

  const ctas = uniq(
    body
      .querySelectorAll("a, button")
      .map((a) => clean(a.text))
      .filter((t) => t.length > 2 && t.length <= 28 && CTA_WORDS.test(t)),
  ).slice(0, 3);

  // Inline SVGs carry their own <title>s; the page's is the one in <head>.
  const title = clean((root.querySelector("head title") ?? root.querySelector("title"))?.text);
  const siteName = meta('meta[property="og:site_name"]');
  const description = meta('meta[name="description"]');
  const ogTitle = meta('meta[property="og:title"]');
  const template = [title, description, ogTitle].find((s) => s && TEMPLATE.test(s)) ?? "";

  return {
    url,
    name: siteName || brandFromTitle(title) || new URL(url).hostname.replace(/^www\./, ""),
    title,
    description,
    h1s,
    h2s,
    lang: clean(root.querySelector("html")?.getAttribute("lang")),
    canonical: clean(root.querySelector('link[rel="canonical"]')?.getAttribute("href")),
    og: { title: ogTitle, description: meta('meta[property="og:description"]'), image: meta('meta[property="og:image"]'), siteName },
    twitterCard: meta('meta[name="twitter:card"]'),
    jsonLdTypes: uniq(jsonLdTypes),
    images: images.length,
    imagesWithAlt: images.filter((i) => i.hasAttribute("alt")).length,
    robotsMeta: [meta('meta[name="robots"]'), meta('meta[name="googlebot"]')].filter(Boolean).join(", "),
    words,
    spaShell,
    text: text.slice(0, 20_000),
    paragraphs,
    firstParagraph,
    prices: findPrices(flat),
    integrations: KNOWN_INTEGRATIONS.filter((n) => new RegExp(`\\b${n.replace(/ /g, "\\s")}\\b`).test(flat)).slice(0, 8),
    proof: findProof(flat),
    audience: findAudience([...h1s, description, title, firstParagraph].join(". ")),
    ctas,
    social,
    pricingHref,
    links,
    template,
  };
}

function collectTypes(node: unknown, out: string[]) {
  if (Array.isArray(node)) return node.forEach((n) => collectTypes(n, out));
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string") out.push(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.push(x));
    if (o["@graph"]) collectTypes(o["@graph"], out);
  }
}

function absolute(href: string, base: string) {
  try {
    const u = new URL(href, base);
    u.search = "";
    u.hash = href.includes("#") ? u.hash : "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function brandFromTitle(title: string) {
  const parts = title.split(/\s[|\-–—·]\s|:\s/).map(clean).filter(Boolean);
  if (parts.length < 2) return parts[0]?.split(/\s/).length <= 3 ? parts[0] : "";
  // The brand is usually the shortest side of "Brand | tagline" or "Tagline – Brand".
  return [...parts].sort((a, b) => a.length - b.length)[0];
}

/*
 * Plan prices only. Skips amounts about revenue, savings or the cost of a
 * hire ("replaces a $5,000/mo hire", "$3M ARR"), and never cuts a number
 * short ("$3,000" is not "$3,00").
 */
const PRICE = /(?:US\$|\$|€|£)\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(?![\d,.]*\d)(?!\s?(?:[kKmMbB]|bn|million|billion)\b)(?:\s?\/\s?(mo|month|mth|yr|year|user|seat)\b)?/g;
const NOT_PRICE_AFTER = /^\W{0,3}(?:\/\s?\w+\s)?(?:job|hire|salary|agency|agencies|in\s|of\s(?:revenue|sales)|arr|mrr|revenue|raised|funding|saved|worth|valuation|off\b|discount|credit|budget|ad spend)/i;
const NOT_PRICE_BEFORE = /(?:save|saved|saving|raised|revenue|arr|mrr|worth|valuation|replaces?(?: a| an)?|instead of|earned|made|generated|spent|costs? you|up to|over|paid out|hire|agency|writer|manager|freelancer|consultant|contractor|employee|salary|growth|cost|per month)\s*$/i;

export function findPrices(text: string) {
  const found: { s: string; amount: number; period: boolean }[] = [];
  for (const m of text.matchAll(PRICE)) {
    const i = m.index ?? 0;
    const end = i + m[0].length;
    const amount = Number(m[1].replace(/,/g, "") + (m[2] ?? ""));
    if (amount >= 10_000 || amount < 1) continue;
    if (NOT_PRICE_AFTER.test(text.slice(end, end + 18)) || NOT_PRICE_BEFORE.test(text.slice(Math.max(0, i - 28), i))) continue;
    found.push({ s: m[0].replace(/\s+/g, ""), amount, period: !!m[3] });
  }
  // Plans on one page sit within an order of magnitude; "$5,000/mo" next to "$29/mo" is a comparison, not a plan.
  const cheapest = Math.min(...found.filter((f) => f.amount > 0).map((f) => f.amount));
  return uniq(
    found
      .filter((f) => f.amount <= cheapest * 12)
      .sort((a, b) => Number(b.period) - Number(a.period) || a.amount - b.amount)
      .map((f) => f.s),
  ).slice(0, 5);
}

export function findProof(text: string) {
  const re = /\b\d[\d,.]*\s?[kKmM]?\+?\s+(?:customers|users|teams|companies|businesses|developers|creators|stores|freelancers|founders|brands|downloads|reviews)\b/g;
  return uniq((text.match(re) ?? []).map(clean)).slice(0, 4);
}

export function findAudience(text: string) {
  const m = text.match(/\b(?:built |made |designed )?for\s+((?:[a-z]+[-\s]){0,3}(?:teams|founders|freelancers|developers|marketers|agencies|creators|startups|businesses|companies|shops|stores|designers|engineers|individuals|professionals|sellers))\b/i);
  return m ? clean(m[1]).toLowerCase() : "";
}

export function parseRobots(input: { status: "ok"; text: string } | { status: "missing" } | { status: "unreadable" }): RobotsFacts {
  const allowAll = (status: RobotsFacts["status"]): RobotsFacts => ({
    status,
    blocksAll: false,
    bots: AI_BOTS.map((b) => ({ ...b, allowed: true, ownGroup: false })),
    sitemaps: [],
  });
  if (input.status !== "ok") return allowAll(input.status);

  type Rule = { allow: boolean; path: string; line: number };
  type G = { agents: string[]; rules: Rule[] };
  const groups: G[] = [];
  const sitemaps: string[] = [];
  const signals: string[] = [];
  let cur: G | null = null;
  let lastWasAgent = false;
  input.text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) return;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "sitemap") return void (val && sitemaps.push(val));
    if (key === "content-signal") return void (val && signals.push(val));
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (cur && (key === "allow" || key === "disallow")) cur.rules.push({ allow: key === "allow", path: val, line: idx + 1 });
  });

  const access = (ua: string) => {
    // RFC 9309: every group naming this agent applies, merged; otherwise every "*" group.
    const own = groups.filter((g) => g.agents.includes(ua.toLowerCase()));
    const use = own.length ? own : groups.filter((g) => g.agents.includes("*"));
    let best: (Rule & { len: number }) | null = null;
    for (const r of use.flatMap((g) => g.rules)) {
      if (r.path === "") continue;
      if (r.path === "/" || r.path === "/*" || r.path === "*" || r.path === "/$") {
        const len = r.path.length;
        if (!best || len > best.len || (len === best.len && r.allow)) best = { ...r, len };
      }
    }
    return { allowed: best ? best.allow : true, line: best?.line, rule: best ? `${best.allow ? "Allow" : "Disallow"}: ${best.path}` : undefined, ownGroup: own.length > 0 };
  };

  return {
    status: "ok",
    blocksAll: !access("*").allowed,
    bots: AI_BOTS.map((b) => ({ ...b, ...access(b.ua) })),
    sitemaps,
    contentSignal: signals[0],
  };
}

export function parseLlms(txt: string | null): LlmsFacts {
  if (txt == null || !txt.trim() || /<html/i.test(txt)) return { found: false, lines: 0 };
  return { found: true, lines: txt.trim().split(/\n/).length };
}

/* ---------- Fixes: the agent's first draft of the change, ready to review. ---------- */

export function metaDescriptionFor(p: PageFacts): string {
  const src = p.firstParagraph || p.og.description || p.h1s[0] || p.title;
  if (!src) return `${p.name}: what it is, who it's for, and what it costs, in one sentence.`;
  if (src.length <= 158) return src;
  const cut = src.slice(0, 158);
  const sentence = cut.lastIndexOf(". ");
  return sentence > 70 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}.`;
}

function priceOffer(p: PageFacts) {
  const monthly = p.prices.filter((x) => /\/(mo|month|mth)/.test(x));
  const first = monthly[0] ?? p.prices[0];
  if (!first) return undefined;
  const amount = first.match(/\d[\d,]*(?:\.\d{1,2})?/)?.[0]?.replace(/,/g, "");
  const currency = first.includes("€") ? "EUR" : first.includes("£") ? "GBP" : "USD";
  return { "@type": "Offer", price: amount, priceCurrency: currency };
}

export function jsonLdFor(p: PageFacts) {
  const origin = new URL(p.url).origin;
  const offer = priceOffer(p);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: p.name,
        url: origin,
        ...(p.social.length ? { sameAs: p.social } : {}),
      },
      {
        "@type": "SoftwareApplication",
        name: p.name,
        url: origin,
        description: p.description || metaDescriptionFor(p),
        operatingSystem: "Web",
        ...(offer ? { offers: offer } : {}),
        ...(p.og.image ? { image: p.og.image } : {}),
      },
    ],
  };
}

export function llmsTxtFor(p: PageFacts): string {
  const lines = [`# ${p.name}`, "", `> ${p.description || metaDescriptionFor(p)}`, ""];
  const facts = [
    p.audience && `- Built for: ${p.audience}`,
    p.prices.length && `- Pricing: ${p.prices.join(", ")}`,
    p.integrations.length && `- Integrations: ${p.integrations.join(", ")}`,
    p.proof.length && `- Proof: ${p.proof.join("; ")}`,
  ].filter(Boolean) as string[];
  if (facts.length) lines.push("## Facts", ...facts, "");
  if (p.links.length) lines.push("## Key pages", ...p.links.slice(0, 8).map((l) => `- [${l.text}](${l.href})`), "");
  return lines.join("\n").trimEnd() + "\n";
}

function robotsDiff(r: RobotsFacts): string {
  const blocked = r.bots.filter((b) => b.tier === "search" && !b.allowed);
  const out: string[] = [];
  for (const b of blocked) {
    if (b.ownGroup && b.line) out.push(`  User-agent: ${b.ua}`, `- ${b.rule}    (line ${b.line})`, `+ Allow: /`, "");
    else out.push(`+ User-agent: ${b.ua}`, `+ Allow: /`, "");
  }
  return out.join("\n").trimEnd() + "\n";
}

const TOOLS = {
  meta: { name: "Meta Description Generator", href: "https://okara.ai/tools/meta-description-generator" },
  og: { name: "Meta Tag Checker", href: "https://okara.ai/tools/meta-tag-checker" },
  jsonld: { name: "Schema Markup Generator", href: "https://okara.ai/tools/schema-markup-generator" },
  llms: { name: "llms.txt Generator", href: "https://okara.ai/tools/llms-txt-generator" },
  robots: { name: "Robots.txt Checker", href: "https://okara.ai/tools/robots-txt-generator" },
} as const;

/** Drafts a fix for each failing check the agent can fix. Passing checks get nothing. */
export function buildFixes(p: PageFacts, robots: RobotsFacts, checks: Check[]): Fix[] {
  const failing = new Set(checks.filter((c) => !c.pass && !c.unknown && c.fixId).map((c) => c.fixId));
  const fixes: Fix[] = [];
  if (failing.has("robots")) {
    const shared = robots.bots.some((b) => b.tier === "search" && !b.allowed && b.ownGroup);
    fixes.push({
      id: "robots",
      title: "Let AI search engines back in",
      agent: "Coding",
      where: "Edit /robots.txt",
      lang: "diff",
      code: robotsDiff(robots),
      review: `Only the search crawlers change. Your training opt-outs (GPTBot, ClaudeBot and others) stay exactly as they are.${shared ? " If a line names several crawlers, move these onto their own lines first." : ""}`,
      tool: TOOLS.robots,
    });
  }
  if (failing.has("meta")) {
    fixes.push({
      id: "meta",
      title: "Write the line people read under your name in Google",
      agent: "SEO",
      where: "Inside <head> on your homepage",
      lang: "html",
      code: `<meta name="description" content="${escapeAttr(metaDescriptionFor(p))}">`,
      review: "Taken from your own homepage copy. Edit it so it sounds like you.",
      tool: TOOLS.meta,
    });
  }
  if (failing.has("jsonld")) {
    fixes.push({
      id: "jsonld",
      title: "Tell search engines what you sell",
      agent: "Coding",
      where: "Inside <head> on your homepage",
      lang: "html",
      // "<" is escaped so a description can never close the script tag early.
      code: `<script type="application/ld+json">\n${JSON.stringify(jsonLdFor(p), null, 2).replace(/</g, "\\u003c")}\n</script>`,
      review: priceOffer(p) ? `Check that ${priceOffer(p)!.price} ${priceOffer(p)!.priceCurrency} is your starting plan.` : "Add your starting price as an Offer if you have one.",
      tool: TOOLS.jsonld,
    });
  }
  if (failing.has("og")) {
    fixes.push({
      id: "og",
      title: "Make shared links show a proper card",
      agent: "SEO",
      where: "Inside <head> on your homepage",
      lang: "html",
      code: [
        `<meta property="og:title" content="${escapeAttr(p.og.title || p.title || p.name)}">`,
        `<meta property="og:description" content="${escapeAttr(p.og.description || p.description || metaDescriptionFor(p))}">`,
        `<meta property="og:image" content="${escapeAttr(p.og.image || `${new URL(p.url).origin}/og.png`)}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
      ].join("\n"),
      review: p.og.image ? "Uses your existing share image." : "You'll need a 1200×630 image at /og.png.",
      tool: TOOLS.og,
    });
  }
  if (failing.has("llms")) {
    fixes.push({
      id: "llms",
      title: "Add a one-page brief for AI tools",
      agent: "GEO",
      where: "A new file at /llms.txt",
      lang: "text",
      code: llmsTxtFor(p),
      review: "Built from facts on your homepage. Low effort, low downside; see the note on what it does and doesn't do.",
      tool: TOOLS.llms,
    });
  }
  return fixes;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* ---------- Checks ---------- */

export function runChecks(p: PageFacts, robots: RobotsFacts, llms: LlmsFacts, info: FetchInfo = {}): Check[] {
  const c: Check[] = [];
  const add = (x: Check) => c.push(x);
  const h = info.headers ?? {};
  const xRobots = h["x-robots-tag"] ?? "";
  const directives = `${p.robotsMeta}, ${xRobots}`.toLowerCase();
  const desc = p.description.length;
  const altPct = p.images ? Math.round((p.imagesWithAlt / p.images) * 100) : 100;
  const entityTypes = p.jsonLdTypes.filter((t) => /Organization|SoftwareApplication|Product|WebApplication|LocalBusiness|Service/.test(t));
  const blockedSearch = robots.bots.filter((b) => b.tier === "search" && !b.allowed);
  const blockedTraining = robots.bots.filter((b) => b.tier === "training" && !b.allowed);
  const prices = p.prices.length ? p.prices : (info.pricingPagePrices ?? []);

  add({
    id: "index", group: "seo", severity: "high", pass: !/noindex/.test(directives),
    label: "Search engines can index the page",
    detail: /noindex/.test(directives) ? "The page tells search engines not to index it." : "Nothing blocks indexing.",
    evidence: /noindex/.test(directives) ? (xRobots ? `X-Robots-Tag: ${xRobots}` : `<meta name="robots" content="${p.robotsMeta}">`) : undefined,
    why: "A page that isn't indexed can't show up in search or in AI answers built on search.",
  });
  add({
    id: "meta", group: "seo", severity: "medium", pass: desc >= 50 && desc <= 160,
    label: "Meta description says what you do",
    detail: desc ? `${desc} characters${desc < 50 ? ", too short to say much" : desc > 160 ? ", so it gets cut off" : ""}.` : "Missing. Google writes one from your page text, often not the line you'd pick.",
    evidence: desc ? `<meta name="description" content="${truncate(p.description, 90)}">` : undefined,
    why: "It's the sentence under your name in search results, and often what people decide on.",
    fixId: "meta",
  });
  add({
    id: "og", group: "seo", severity: "medium", pass: !!(p.og.title && p.og.description && p.og.image),
    label: "Shared links show a card",
    detail: p.og.image
      ? p.og.title && p.og.description ? "Title, description and image are set." : "Image set, but the title or description is missing."
      : "No share image, so links on X, LinkedIn and Slack show as a bare URL.",
    evidence: p.og.image ? `og:image ${truncate(p.og.image, 60)}` : undefined,
    why: "Every agent post links back here. A bare link gets fewer clicks.",
    fixId: "og",
  });
  add({
    id: "template", group: "seo", severity: "medium", pass: !p.template,
    label: "No leftover template text",
    detail: p.template ? `Your title or share card still says “${p.template}”.` : "Titles and share cards are your own.",
    why: "It's the first thing people see in search and in shared links.",
  });
  add({
    id: "title", group: "seo", severity: p.title ? "low" : "medium", pass: p.title.length >= 15 && p.title.length <= 65,
    label: "Page title is a useful length",
    detail: p.title ? `${p.title.length} characters${p.title.length > 65 ? ", so it gets cut off" : p.title.length < 15 ? ", so it says very little" : ""}.` : "No <title> tag.",
    evidence: p.title ? `<title>${truncate(p.title, 80)}</title>` : undefined,
    why: "The title is the blue link in search results. Past about 60 characters it's cut off.",
  });
  add({
    id: "h1", group: "seo", severity: "low", pass: p.h1s.length > 0,
    label: "Has a main heading",
    detail: p.h1s.length ? `“${truncate(p.h1s[0], 80)}”` : "No <h1> on the page.",
    why: "The main heading tells readers and search engines what the page is about.",
  });
  add({
    id: "canonical", group: "seo", severity: "low", pass: !!p.canonical,
    label: "Canonical URL set",
    detail: p.canonical ? "Set." : "Not set, so www, non-www and tracking-link versions can compete.",
    evidence: p.canonical ? `<link rel="canonical" href="${truncate(p.canonical, 60)}">` : undefined,
    why: "Keeps ranking signals on one address.",
  });
  add({
    id: "alt", group: "seo", severity: "low", pass: altPct >= 90,
    label: "Images have alt text",
    detail: p.images ? `${p.imagesWithAlt} of ${p.images} images (${altPct}%).` : "No images in the HTML.",
    why: "Read by screen readers and search engines alike.",
  });

  const thin = p.words >= 150 && p.words < 250 && !p.spaShell;
  const empty = p.words < 50 || (p.spaShell && p.words < 150);
  add({
    id: "content", group: "ai", severity: empty ? "high" : "low", pass: !empty && !thin,
    label: "Readable without JavaScript",
    detail: empty
      ? `${p.words} words in the raw HTML${p.spaShell ? ", and the page is an empty app shell" : ""}. Crawlers that don't run JavaScript see almost nothing.`
      : thin ? `${p.words} words in the raw HTML. Readable, but thin.` : `${p.words.toLocaleString("en-US")} words in the raw HTML.`,
    why: "GPTBot, ClaudeBot and PerplexityBot read raw HTML and don't run JavaScript. Googlebot does.",
  });
  add({
    id: "crawlers", group: "ai", severity: "high",
    pass: robots.status !== "ok" || (!robots.blocksAll && blockedSearch.length === 0),
    unknown: robots.status === "unreadable",
    label: "AI search crawlers can read you",
    detail:
      robots.status === "unreadable" ? "robots.txt didn't load, so this couldn't be checked."
      : robots.status === "missing" ? "No robots.txt, so every crawler is allowed."
      : blockedSearch.length
        ? `Blocked: ${blockedSearch.map((b) => `${b.who} (${b.ua})`).join(", ")}.${blockedTraining.length ? ` You've also opted out of training (${blockedTraining.map((b) => b.ua).join(", ")}), which is a fair choice and separate.` : ""}`
        : `ChatGPT search, Claude search, Perplexity, Google and Bing are allowed.${blockedTraining.length ? ` You've opted out of training (${blockedTraining.map((b) => b.ua).join(", ")}); that doesn't affect answers.` : ""}`,
    evidence: blockedSearch.find((b) => b.line) ? blockedSearch.filter((b) => b.line).map((b) => `robots.txt line ${b.line}: ${b.rule} (${b.ua})`).join("\n") : undefined,
    why: "A blocked search crawler can't cite you, however good your content is.",
    fixId: blockedSearch.length ? "robots" : undefined,
  });
  add({
    id: "snippet", group: "ai", severity: "medium", pass: !/nosnippet|max-snippet\s*:\s*0\b/.test(directives),
    label: "Google may quote this page",
    detail: /nosnippet|max-snippet\s*:\s*0\b/.test(directives) ? "A nosnippet rule stops Google quoting the page, including in AI Overviews and AI Mode." : "No snippet restrictions.",
    why: "nosnippet is Google's documented switch for keeping a page out of its AI features.",
  });
  add({
    id: "jsonld", group: "ai", severity: "medium", pass: entityTypes.length > 0,
    label: "Structured data says what you are",
    detail: entityTypes.length
      ? `Found ${entityTypes.join(", ")}.`
      : p.jsonLdTypes.length ? `Has ${p.jsonLdTypes.join(", ")}, but nothing that names the product or company.` : "No structured data, so engines infer what you sell from prose.",
    why: "Search engines use it to understand what you are, and AI answers built on search inherit that.",
    fixId: "jsonld",
  });
  add({
    id: "pricing", group: "ai", severity: "medium", pass: prices.length > 0,
    label: "Price is stated in plain text",
    detail: p.prices.length
      ? `Found ${p.prices.slice(0, 3).join(", ")} on the homepage.`
      : prices.length ? `Found ${prices.slice(0, 3).join(", ")} on your pricing page.` : "No price on the homepage or a linked pricing page.",
    why: "When someone asks an assistant what a tool costs, it needs a number it can check.",
  });
  add({
    id: "proof", group: "ai", severity: "low", pass: p.proof.length > 0,
    label: "Numbers someone could repeat",
    detail: p.proof.length ? p.proof.join("; ") : "No customer counts or other numbers on the homepage.",
    why: "Answers favour specifics they can verify over adjectives.",
  });
  add({
    id: "sitemap", group: "ai", severity: "low", pass: robots.sitemaps.length > 0,
    unknown: robots.status === "unreadable",
    label: "Sitemap listed in robots.txt",
    detail: robots.sitemaps.length ? "Listed." : "No Sitemap: line, so crawlers find pages on their own.",
    evidence: robots.sitemaps[0] ? `Sitemap: ${truncate(robots.sitemaps[0], 70)}` : undefined,
    why: "Points every crawler at your full list of pages.",
  });
  add({
    id: "llms", group: "ai", severity: "low", pass: llms.found,
    label: "llms.txt brief",
    detail: llms.found ? `Found, ${llms.lines} lines.` : "No /llms.txt.",
    why: "Cheap to add and used by coding agents and docs tools. No major AI search engine has confirmed reading it for answers, so treat it as a bonus.",
    fixId: "llms",
  });
  return c;
}

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Failing checks, most important first; ones the agent can fix rank above equal ones it can't. */
export function rankIssues(checks: Check[]) {
  return checks
    .filter((c) => !c.pass && !c.unknown)
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || Number(!!b.fixId) - Number(!!a.fixId));
}

/** The one fix to show first, or null when nothing the agent can fix is failing. */
export function firstFix(result: Pick<AuditResult, "checks" | "fixes">): Fix | null {
  const top = rankIssues(result.checks).find((c) => c.fixId && result.fixes.some((f) => f.id === c.fixId));
  return result.fixes.find((f) => f.id === top?.fixId) ?? null;
}

export function audit(input: {
  url: string;
  html: string;
  robots: Parameters<typeof parseRobots>[0];
  llms: string | null;
  info?: FetchInfo;
  example?: boolean;
  now?: Date;
}): AuditResult {
  const full = parsePage(input.html, input.url);
  const robots = parseRobots(input.robots);
  const llms = parseLlms(input.llms);
  const checks = runChecks(full, robots, llms, input.info);
  const notes: string[] = [];
  const h = input.info?.headers ?? {};
  if (h["cf-ray"] || /cloudflare/i.test(h["server"] ?? "")) {
    notes.push("This site is behind Cloudflare, which can block AI crawlers at the network level even when robots.txt allows them. Check AI Crawl Control in Cloudflare.");
  }
  if (robots.contentSignal) notes.push(`robots.txt sets Content-Signal: ${robots.contentSignal}.`);
  const counted = checks.filter((c) => !c.unknown);
  const { text, links, paragraphs, ...page } = full;
  void links;
  void paragraphs;
  return {
    url: input.url,
    host: new URL(input.url).hostname,
    example: !!input.example,
    fetchedAt: (input.now ?? new Date()).toISOString(),
    page,
    excerpt: truncate(text.replace(/\n/g, " "), 700),
    robots,
    llms,
    checks,
    fixes: buildFixes(full, robots, checks),
    docs: strategyDocs(full),
    notes,
    counts: { pass: counted.filter((c) => c.pass).length, total: counted.length },
  };
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
