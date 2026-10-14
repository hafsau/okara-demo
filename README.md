# The First 60 Seconds

**An Okara onboarding concept.** An unofficial concept by [Hafsa Usmani](https://hafsausmani.com) for Okara's **Product Designer (UI/UX)** role.

> **Not affiliated with Okara.** Site checks are real and run live on the URL you enter. Quillmate, the feed drafts and the credit usage are illustrative. Brand tokens and the pixel mark are taken from okara.ai to show the work in context. The site is noindexed.

## The idea

Okara's design role asks for the three things you'd fix first in the product's first ten minutes, ranked. This repo answers with working code instead of a list.

- **`/`: the first 60 seconds.** Paste any URL however you like.
  - Rule-based checks stream into Okara's own "AI CMO Terminal" metaphor, with real timings.
  - The dashboard opens on the **one fix that matters most** for that site, drafted and ready to copy, before any sign-up.
  - "N of M checks pass", each with evidence: the exact tag, or the robots.txt line.
  - A **How AI assistants see you** tab: raw HTML versus what a person sees, plus crawler access in three tiers (search, user-initiated, training).
  - The five strategy docs: three are built from the site's own copy right away, two are honestly queued.
  - If everything passes, it says so instead of inventing a fix (okara.ai passes all 16).
- **`/teardown`: the three fixes**, each written as a PR description (change, why, metric, smallest version, rollback), with a working prototype. Includes an interactive Agents Feed card with credit costs and a burn line. Notes cover the decision log, threat model, crawler sources, and real vs illustrative.

Deep links: `/?example` runs the bundled example. `/?url=yoursite.com` runs a live check.

## How the checks work

`lib/audit.ts` is pure and unit-tested; nothing calls a model.
- **Search basics:** indexability (meta and X-Robots-Tag), meta description, share card, template leftovers, title, H1, canonical, alt text.
- **AI answers:** readable without JavaScript (including empty-SPA-shell detection), search-crawler access from robots.txt (RFC 9309 group merging, line-level evidence), nosnippet, structured data, a plain-text price (from the homepage or a linked pricing page), verifiable proof, sitemap, and llms.txt (low severity, labelled honestly).
- **Fixes** are drafted only for failing checks:
  - a robots.txt diff that leaves training opt-outs alone
  - a meta description from the site's own copy
  - Organization and SoftwareApplication JSON-LD, with `<` escaped
  - OG tags
  - llms.txt

  Each fix links to the free Okara tool that already does that job.

`app/api/audit/route.ts` streams NDJSON. Every network step sends `start` before it begins, and every stream ends with a `result` or an `error`. `lib/safe-fetch.ts` adds the safety limits:
- public IPs only, checked after DNS
- standard ports only
- at most 3 redirects
- one timeout for the whole request
- a 4 MB read cap

The route reads only the homepage, robots.txt, llms.txt and one linked pricing page. `lib/limits.ts` adds a per-IP rate limit, a per-host cache and a daily cap.

## Stack and quality gates

- **Stack:** Next.js 16, React 19, Tailwind 4, node-html-parser, Vercel Analytics.
- **Unit tests:** `npm test`, 27 Vitest tests covering URL cleanup, private-IP blocking, robots.txt parsing, the price heuristics (cost-comparison tables, k/M amounts, thousands separators), minified HTML, SPA shells, fix generation, docs and limits.
- **End-to-end:** `npm run e2e`, Playwright with axe across desktop, tablet and mobile: zero WCAG 2.2 AA violations and no horizontal scroll.
- **Lighthouse:** `npx @lhci/cli autorun`. Accessibility 100 on every page and CLS ≤ 0.02. SEO is low on purpose, because the site is noindexed.

```bash
npm ci && npm run dev
```
