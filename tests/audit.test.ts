import { describe, expect, it } from "vitest";
import { audit, findAudience, findPrices, findProof, firstFix, parseLlms, parsePage, parseRobots, rankIssues } from "@/lib/audit";
import { voiceStats } from "@/lib/docs";
import { EXAMPLE } from "@/lib/example";
import { allow, cached, remember } from "@/lib/limits";
import { isPrivateIp } from "@/lib/safe-fetch";
import { normalizeUrl } from "@/lib/url";

const ok = (text: string) => ({ status: "ok" as const, text });
const bot = (r: ReturnType<typeof parseRobots>, ua: string) => r.bots.find((b) => b.ua === ua)!;

describe("normalizeUrl", () => {
  it("accepts what people actually paste, and says what it changed", () => {
    const n = normalizeUrl("  https://www.Stripe.com/pricing?ref=nav#top ");
    expect(n).toMatchObject({ ok: true, url: "https://www.stripe.com/", host: "www.stripe.com", display: "stripe.com" });
    if (n.ok) expect(n.changed).toEqual(["removed https://", "reading the homepage, not /pricing", "dropped the query string", "dropped the #fragment"]);
  });
  it("accepts bare domains, www and punycode", () => {
    expect(normalizeUrl("www.okara.ai")).toMatchObject({ ok: true, url: "https://www.okara.ai/", display: "okara.ai", changed: [] });
    expect(normalizeUrl("linear.app")).toMatchObject({ ok: true, url: "https://linear.app/" });
    expect(normalizeUrl("bücher.de")).toMatchObject({ ok: true, host: "xn--bcher-kva.de" });
  });
  it("explains what's wrong instead of failing silently", () => {
    expect(normalizeUrl("")).toMatchObject({ ok: false });
    expect(normalizeUrl("me@site.com")).toMatchObject({ ok: false, reason: expect.stringContaining("email") });
    expect(normalizeUrl("ftp://site.com")).toMatchObject({ ok: false });
    expect(normalizeUrl("localhost:3000")).toMatchObject({ ok: false });
    expect(normalizeUrl("192.168.0.1")).toMatchObject({ ok: false });
    expect(normalizeUrl("site.com:8080")).toMatchObject({ ok: false });
    expect(normalizeUrl("my site.com")).toMatchObject({ ok: false });
    expect(normalizeUrl("notadomain")).toMatchObject({ ok: false });
  });
});

describe("isPrivateIp", () => {
  it("blocks private, loopback, link-local, CGNAT, benchmark and mapped ranges", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:a00:1", "64:ff9b::a00:1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "76.76.21.21", "2606:4700::1111", "::ffff:808:808"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("parseRobots", () => {
  it("treats missing as allow-all and unreadable as unknown", () => {
    expect(parseRobots({ status: "missing" }).bots.every((b) => b.allowed)).toBe(true);
    const u = audit({ url: "https://a.test/", html: "<title>A test site title</title>", robots: { status: "unreadable" }, llms: null });
    expect(u.checks.find((c) => c.id === "crawlers")).toMatchObject({ unknown: true });
  });
  it("separates training opt-outs from search blocks", () => {
    const r = parseRobots(ok("User-agent: *\nDisallow:\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nSitemap: https://x.com/sitemap.xml"));
    expect(bot(r, "GPTBot")).toMatchObject({ allowed: false, tier: "training", line: 6 });
    expect(bot(r, "ClaudeBot").tier).toBe("training");
    expect(bot(r, "Claude-SearchBot")).toMatchObject({ allowed: true, tier: "search" });
    expect(bot(r, "Google-Extended").tier).toBe("training");
    expect(r.sitemaps).toEqual(["https://x.com/sitemap.xml"]);
    const a = audit({ url: "https://x.com/", html: "<title>X</title>", robots: ok("User-agent: GPTBot\nDisallow: /"), llms: null });
    expect(a.checks.find((c) => c.id === "crawlers")).toMatchObject({ pass: true });
    expect(a.fixes.find((f) => f.id === "robots")).toBeUndefined();
  });
  it("merges repeated groups for the same agent (RFC 9309)", () => {
    const r = parseRobots(ok("User-agent: OAI-SearchBot\nDisallow: /private\n\nUser-agent: OAI-SearchBot\nDisallow: /"));
    expect(bot(r, "OAI-SearchBot")).toMatchObject({ allowed: false, line: 5 });
  });
  it("lets Allow win a tie, detects block-all, ignores path rules and reads Content-Signal", () => {
    expect(parseRobots(ok("User-agent: *\nDisallow: /\nAllow: /")).blocksAll).toBe(false);
    expect(parseRobots(ok("User-agent: *\nDisallow: /")).blocksAll).toBe(true);
    expect(parseRobots(ok("User-agent: *\nDisallow: /admin")).blocksAll).toBe(false);
    expect(parseRobots(ok("User-agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /")).contentSignal).toBe("search=yes, ai-train=no");
  });
});

describe("parseLlms", () => {
  it("rejects soft-404 HTML", () => {
    expect(parseLlms("<html><body>Not found</body></html>").found).toBe(false);
    expect(parseLlms("# Site\n> About\n").found).toBe(true);
  });
});

describe("findPrices", () => {
  it("keeps plan prices and never truncates numbers", () => {
    expect(findPrices("Free, then $12/mo or $99 / year. €9 too.")).toEqual(["$12/mo", "$99/year", "€9"]);
    expect(findPrices("Lite is $1,290/yr or $129/mo.")).toEqual(["$129/mo", "$1,290/yr"]);
    expect(findPrices("Pay $3,000 once")).toEqual(["$3,000"]);
  });
  it("skips revenue, savings and cost-of-hire amounts", () => {
    expect(findPrices("The $14,000/mo job from $129/mo. Replaces a $5,000/mo hire.")).toEqual(["$129/mo"]);
    expect(findPrices("We hit $3M ARR and raised $20 million. Customers saved $400 a month.")).toEqual([]);
    expect(findPrices("$2.5k in revenue")).toEqual([]);
    expect(findPrices("$1.9T in payments volume processed")).toEqual([]);
    expect(findPrices("Start at $129. Lite is $129/mo.")).toEqual(["$129/mo"]);
  });
});

describe("other extractors", () => {
  it("finds proof and audience", () => {
    expect(findProof("Trusted by 8,000+ freelancers and 12k teams.")).toEqual(["8,000+ freelancers", "12k teams"]);
    expect(findAudience("Invoicing built for busy freelancers.")).toBe("busy freelancers");
    expect(findAudience("Nothing here.")).toBe("");
  });
  it("counts words in minified HTML", () => {
    const p = parsePage("<body><nav><a>Pricing</a><a>Features</a><a>Docs</a></nav><p>One</p><p>Two</p></body>", "https://m.test/");
    expect(p.words).toBe(5);
  });
  it("flags empty app shells and template leftovers", () => {
    const p = parsePage('<html><head><title>Lovable Generated Project</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>', "https://s.test/");
    expect(p.spaShell).toBe(true);
    expect(p.template).toBe("Lovable Generated Project");
  });
});

describe("example site audit", () => {
  const r = audit({ url: EXAMPLE.url, html: EXAMPLE.html, robots: ok(EXAMPLE.robots), llms: EXAMPLE.llms, example: true, now: new Date("2026-10-14") });

  it("reads real facts from the page", () => {
    expect(r.page.name).toBe("Quillmate");
    expect(r.page.h1s).toEqual(["Get paid on time without chasing anyone"]);
    expect(r.page.prices).toEqual(["$12/mo"]);
    expect(r.page.integrations).toEqual(expect.arrayContaining(["Stripe", "PayPal", "QuickBooks", "Xero"]));
    expect(r.page.proof).toEqual(["8,000+ freelancers"]);
    expect(r.page.imagesWithAlt).toBe(1);
    expect(r.excerpt.startsWith("Quillmate Pricing Features")).toBe(true);
    expect(r).not.toHaveProperty("page.text");
  });

  it("finds the accidental search block, not the deliberate training opt-out", () => {
    const crawl = r.checks.find((c) => c.id === "crawlers")!;
    expect(crawl.pass).toBe(false);
    expect(crawl.detail).toContain("ChatGPT search (OAI-SearchBot)");
    expect(crawl.detail).toContain("Perplexity answers (PerplexityBot)");
    expect(crawl.detail).toContain("opted out of training");
    expect(crawl.evidence).toContain("robots.txt line 12: Disallow: /");
  });

  it("only drafts fixes for failing checks, and ranks the crawler fix first", () => {
    expect(r.fixes.map((f) => f.id).sort()).toEqual(["jsonld", "llms", "meta", "og", "robots"]);
    expect(rankIssues(r.checks)[0].id).toBe("crawlers");
    expect(firstFix(r)?.id).toBe("robots");
    const diff = r.fixes.find((f) => f.id === "robots")!.code;
    expect(diff).toContain("  User-agent: OAI-SearchBot\n- Disallow: /    (line 12)\n+ Allow: /");
    expect(diff).not.toContain("GPTBot");
  });

  it("drafts valid, safe JSON-LD", () => {
    const ld = r.fixes.find((x) => x.id === "jsonld")!;
    const json = JSON.parse(ld.code.replace(/^<script[^>]*>|<\/script>$/g, ""));
    expect(json["@graph"][0]).toMatchObject({ "@type": "Organization", name: "Quillmate" });
    expect(json["@graph"][1]).toMatchObject({ "@type": "SoftwareApplication", offers: { price: "12", priceCurrency: "USD" } });
    const evil = audit({ url: "https://e.test/", html: '<meta name="description" content="x</script><script>alert(1)</script>">', robots: { status: "missing" }, llms: null });
    expect(evil.fixes.find((f) => f.id === "jsonld")!.code.match(/<\/script>/g)).toHaveLength(1);
  });

  it("builds the docs it can, marks plans, and is honest about the rest", () => {
    expect(r.docs.map((d) => [d.file, d.status, d.plan])).toEqual([
      ["product-information.md", "ready", "free"],
      ["marketing-strategy.md", "queued", "free"],
      ["competitor-analysis.md", "queued", "lite"],
      ["brand-voice.md", "ready", "lite"],
      ["content-strategy.md", "ready", "free"],
    ]);
    expect(r.docs[4].sections[0].body).toContain("Simple pricing");
    const voice = r.docs[3].sections[1].body.join(" ");
    expect(voice).not.toMatch(/Simple pricing Free/);
  });
});

describe("a well-built page", () => {
  const html = `<html lang="en"><head><title>Acme | Scheduling for busy teams</title>
    <meta name="description" content="Acme books meetings across time zones for busy teams, with no back-and-forth emails. Free for one user, $8/mo after that.">
    <meta property="og:title" content="Acme"><meta property="og:description" content="Scheduling"><meta property="og:image" content="https://acme.test/og.png">
    <link rel="canonical" href="https://acme.test/">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"SoftwareApplication"}]}</script>
    </head><body><h1>Meetings, minus the email</h1>${"<p>Acme finds the time that works for everyone and sends the invite, used by 2,000 teams. </p>".repeat(30)}<p>$8/mo</p></body></html>`;
  const r = audit({ url: "https://acme.test/", html, robots: ok("User-agent: *\nAllow: /\nSitemap: https://acme.test/sitemap.xml"), llms: "# Acme\n> Scheduling\n" });

  it("passes everything and offers no invented fix", () => {
    expect(r.checks.filter((c) => !c.pass)).toEqual([]);
    expect(r.counts.pass).toBe(r.counts.total);
    expect(r.fixes).toEqual([]);
    expect(firstFix(r)).toBeNull();
  });

  it("reads noindex and nosnippet from headers too", () => {
    const h = audit({ url: "https://acme.test/", html, robots: { status: "missing" }, llms: null, info: { headers: { "x-robots-tag": "nosnippet", "cf-ray": "1" } } });
    expect(h.checks.find((c) => c.id === "snippet")?.pass).toBe(false);
    expect(h.notes[0]).toContain("Cloudflare");
  });

  it("uses og:site_name or the short side of the title as the brand", () => {
    expect(parsePage("<title>Ship faster — Linear</title>", "https://linear.app/").name).toBe("Linear");
    expect(parsePage('<meta property="og:site_name" content="Okara"><title>Meet Okara, the AI CMO</title>', "https://okara.ai/").name).toBe("Okara");
    expect(parsePage('<meta property="og:site_name" content="Buffer: All-you-need social media toolkit for small businesses">', "https://buffer.com/").name).toBe("Buffer");
  });

  it("counts prices from a linked pricing page", () => {
    const noPrice = html.replace(/\$8\/mo/g, "");
    const a = audit({ url: "https://acme.test/", html: noPrice, robots: { status: "missing" }, llms: null, info: { pricingPagePrices: ["$8/mo"] } });
    expect(a.checks.find((c) => c.id === "pricing")).toMatchObject({ pass: true, detail: expect.stringContaining("pricing page") });
  });
});

describe("voiceStats", () => {
  it("measures sentence length, person and reading grade", () => {
    const v = voiceStats("You send the invoice. We chase it for you. You get paid on time, every time. Stop chasing money today!");
    expect(v.sentences).toBe(4);
    expect(v.you).toBeGreaterThan(v.we);
    expect(v.exclamations).toBe(1);
    expect(v.grade).toBeLessThan(6);
  });
});

describe("limits", () => {
  it("rate-limits per IP and caches per host", () => {
    const t = Date.UTC(2026, 9, 14);
    for (let i = 0; i < 6; i++) expect(allow("1.1.1.1", t + i)).toBe("ok");
    expect(allow("1.1.1.1", t + 10)).toBe("rate");
    expect(allow("1.1.1.1", t + 61_000)).toBe("ok");
    const r = audit({ url: "https://c.test/", html: "<title>C site</title>", robots: { status: "missing" }, llms: null });
    remember("c.test", r, t);
    expect(cached("c.test", t + 1000)).toBe(r);
    expect(cached("c.test", t + 11 * 60_000)).toBeNull();
  });
});

describe("findPrices on a cost-comparison table", () => {
  it("keeps the plan and drops the roles it replaces", () => {
    const t = "The $14,000/mo job from $129/mo. Full time marketing hire $5,000/mo SEO agency $4,000/mo Content writer $1,500/mo Reddit and community growth $1,000/mo Total per month $14,000+ From $129/mo. Pro $249/mo.";
    expect(findPrices(t)).toEqual(["$129/mo", "$249/mo"]);
  });
});
