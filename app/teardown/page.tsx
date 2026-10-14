import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow } from "@/components/brand";
import { btn } from "@/components/styles";
import { FeedCard } from "@/components/teardown/feed-card";

export const metadata: Metadata = {
  title: "The teardown",
  description: "Three fixes to Okara's first ten minutes, ranked, each written as a PR description with a working prototype.",
};

type Pr = { what: string; why: string; metric: string; smallest: string; rollback: string };

const FIXES: {
  n: number;
  title: string;
  works: string;
  today: ReactNode;
  pr: Pr;
  try?: { href: string; label: string }[];
  extra?: ReactNode;
}[] = [
  {
    n: 1,
    title: "Show something true about my site before the wait",
    works:
      "The AI CMO Terminal is the right idea: setup happens in the open, and every agent works from the same five documents, so nothing drifts off-message.",
    today: (
      <>
        Per the quickstart and terminal docs, setup takes 2 to 5 minutes before the four panels fill in. If that&apos;s still the case, a new founder&apos;s first minute is watching a log, and on Free the first thing
        they can act on sits behind that wait. Okara already has the parts to fill that minute: free meta, schema, robots.txt and llms.txt tools.
      </>
    ),
    pr: {
      what: "Run rule-based checks the moment a URL is submitted, stream each step into the terminal, and open the dashboard on the one fix that matters most for that site, drafted and ready to copy. The LLM docs keep building behind it.",
      why: "It's the earliest point in the funnel and it's free to run: no model calls, so no credits and no risk of a made-up finding on a first impression. If nothing's wrong, it says so and moves on to what the agents will do.",
      metric: "Time to first site-specific finding (target under 10 seconds). Share of new users who copy or ship the first fix. Free-to-Lite conversion for users who saw one.",
      smallest: "Wire the existing Meta Tag Checker and Robots.txt checker into the onboarding terminal, and show one fix card on the dashboard.",
      rollback: "Behind a flag. Off, the terminal behaves exactly as today.",
    },
    try: [
      { href: "/?example", label: "Run the example" },
      { href: "/?url=okara.ai", label: "Run it on okara.ai" },
    ],
    extra: (
      <p className="text-[15px] leading-6 text-muted">
        Paywall placement: seeing and copying the fix is free. Having the Coding agent open the pull request is the paid step. The paid line moves from &ldquo;see anything&rdquo; to &ldquo;have it done for you&rdquo;, which is what Okara sells.
      </p>
    ),
  },
  {
    n: 2,
    title: "Make credits predictable before they're spent",
    works: "Credit costs are fixed per action and published (an X post is 5, a Reddit reply 8, an article 18), and there's a warning at 20% left.",
    today: (
      <>
        A published price list doesn&apos;t help at the moment of approving. If the feed doesn&apos;t already show it, the cost isn&apos;t on the button, the month&apos;s pace isn&apos;t visible, and the 20% warning arrives when
        options are few. One thing worth checking: the docs list 5 one-time credits on Free and 10 credits for an SEO and GEO analysis.
      </>
    ),
    pr: {
      what: "Put the credit cost on every Approve button, show a burn line (“at this pace you run out on day 24”), and add a “why this” row linking each draft to the strategy doc it came from.",
      why: "Credits are the business model. The founder approves everything, so approving should be fast and never surprising. “Why this” makes a draft quicker to trust and points to the doc to edit when it's off.",
      metric: "Mid-month run-outs. Credit and refund tickets. Approvals per active user per week.",
      smallest: "Cost labels on buttons. The data already exists in the credits table.",
      rollback: "Pure UI. Remove the labels.",
    },
    extra: <FeedCard />,
  },
  {
    n: 3,
    title: "Fail out loud, then let me retry now",
    works: "The troubleshooting doc is clear about why setup fails, retries three times automatically, and gives the exact OkaraBot allow rule for Cloudflare and AWS.",
    today: (
      <>
        The docs say the URL field rejects <code className="font-mono text-[14px] text-text">https://</code>, <code className="font-mono text-[14px] text-text">www.</code> and deeper paths, which is how most people paste. They also say
        that if onboarding fails after the URL is accepted, a Retry button appears after about an hour. If either is still true, the first failure a founder meets is silent or slow.
      </>
    ),
    pr: {
      what: "Accept anything URL-shaped and show what was cleaned up (“reading okara.ai, removed https://”). When a step fails, stop the spinner, say which step and why in one line, and offer Retry now, plus the allow rule when it's a firewall.",
      why: "It may already be partly fixed at 6 to 7 deploys a day, which is why it's third. But a founder who meets a silent failure in the first minute rarely comes back to retry an hour later.",
      metric: "Share of onboarding sessions that end in an error with no later success. Median time from failure to retry.",
      smallest: "Normalise the URL on the client: about 30 lines, the same as lib/url.ts in this repo.",
      rollback: "Keep the old validation behind a flag.",
    },
    try: [
      { href: "/?url=https://www.okara.ai/pricing?ref=x", label: "Paste a messy URL" },
      { href: "/?url=does-not-exist-okara-concept.com", label: "See a failure" },
    ],
  },
];

export default function TeardownPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <p className="eyebrow">Teardown · for Fatima and the Okara team</p>
      <h1 className="display mt-3 text-[28px] leading-9 sm:text-4xl sm:leading-[44px]">Three things I&apos;d fix first in Okara&apos;s first ten minutes</h1>
      <div className="mt-5 space-y-4 text-lg leading-7 text-muted">
        <p>
          The design role asked for three fixes, ranked by what actually matters. Here they are, each written the way I&apos;d hand it to an engineer, with a working version you can try.
        </p>
        <p className="text-[15px] leading-6">
          I worked from Okara&apos;s public site, docs and pricing (October 2026), not a live account, so anything about the signed-in flow is phrased as &ldquo;if&rdquo;. The working side is real code: the site checks run on any
          URL you give them.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/?example" className={btn("primary")}>
          Try the first 60 seconds <Arrow />
        </Link>
        <a href="#notes" className={btn("outline")}>
          Decisions and notes
        </a>
      </div>

      <ol className="mt-14 space-y-16">
        {FIXES.map((f) => (
          <li key={f.n} aria-labelledby={`fix-${f.n}`}>
            <p className="font-mono text-[13px] text-muted">Fix {f.n} of 3</p>
            <h2 id={`fix-${f.n}`} className="display mt-1 text-2xl leading-8 sm:text-[28px] sm:leading-9">
              {f.title}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-popover p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-aqua">What works today</p>
                <p className="mt-2 text-[15px] leading-6 text-muted">{f.works}</p>
              </div>
              <div className="rounded-2xl border border-line bg-popover p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-amber">What I&apos;d look at</p>
                <p className="mt-2 text-[15px] leading-6 text-muted">{f.today}</p>
              </div>
            </div>
            <dl className="mt-5 divide-y divide-line-soft rounded-2xl border border-line">
              {(
                [
                  ["The change", f.pr.what],
                  ["Why", f.pr.why],
                  ["How we'd know", f.pr.metric],
                  ["Smallest version this week", f.pr.smallest],
                  ["Rollback", f.pr.rollback],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[180px_1fr] sm:gap-4">
                  <dt className="text-[14px] font-semibold text-text">{k}</dt>
                  <dd className="text-[15px] leading-6 text-muted">{v}</dd>
                </div>
              ))}
            </dl>
            {f.extra && <div className="mt-5">{f.extra}</div>}
            {f.try && (
              <div className="mt-5 flex flex-wrap gap-2">
                {f.try.map((t) => (
                  <Link key={t.href} href={t.href} className={btn("outline", "sm")}>
                    {t.label} <Arrow className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <section className="mt-16 rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="keep">
        <h2 id="keep" className="display text-xl">
          One thing I wouldn&apos;t change
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-muted">
          The five strategy documents as the handoff between research and agents. It makes every draft explainable, which is exactly what the &ldquo;why this&rdquo; row in fix 2 builds on.
        </p>
      </section>

      <section id="notes" className="mt-16 scroll-mt-6" aria-labelledby="notes-title">
        <h2 id="notes-title" className="display text-2xl">
          Notes
        </h2>
        <div className="mt-4 space-y-2">
          <Note title="Decision log">
            <ol className="space-y-3">
              {[
                ["Fix first, not score first.", "I dropped a 0–100 score: the weights can't be defended. Results say “N of M checks pass”, each with the exact tag or robots.txt line as evidence."],
                ["Rules before models in the first minute.", "Deterministic checks cost nothing and can't make things up. The AI pipeline stays where it's strong: strategy and drafts."],
                ["Never invent a problem.", "If every check passes, the screen says so and moves on to distribution. okara.ai passes all 16; it gets that screen, not a filler fix."],
                ["Training isn't search.", "Opting out of GPTBot or ClaudeBot is a fair choice and never fails a check. Only blocked search crawlers do (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot)."],
                ["Paywall at “ship”, not “see”.", "Copying a fix is free; the Coding agent shipping it is paid. Brand Voice shows its first section, matching today's plan split."],
                ["No spinner can outlive an error.", "Every step sends “started” before it begins, every stream ends with a result or an error, and queued docs say what they're waiting for."],
                ["Use Okara's own parts.", "Each drafted fix links to the free Okara tool that already does that job. The idea is wiring, not reinvention."],
              ].map(([t, d]) => (
                <li key={t}>
                  <span className="font-semibold text-text">{t}</span> {d}
                </li>
              ))}
            </ol>
          </Note>
          <Note title="How I used AI">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Research agents read Okara&apos;s site, docs, pricing and public posts in parallel.</li>
              <li>Okara&apos;s colours, type and components were measured from okara.ai&apos;s computed styles, not eyeballed.</li>
              <li>
                A five-seat review panel (founder, design lead, staff engineer, red team, GEO practitioner) critiqued the plan and code. It caught wrong crawler facts and a price-parsing bug that would have shown up on okara.ai itself.
              </li>
              <li>Built in code with Claude Code. Choosing and ranking the three fixes was mine.</li>
            </ul>
          </Note>
          <Note title="What's real and what's illustrative">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Real: every check, finding and drafted fix on the home page, computed from the site you enter, live.</li>
              <li>Real: product information, brand voice and content strategy, built from that site&apos;s own copy, with no model calls.</li>
              <li>Illustrative: Quillmate (a fictional site), the feed drafts, credit usage, and the two queued docs.</li>
              <li>From Okara&apos;s public docs: credit costs, plan contents, setup timing, URL rules and the retry behaviour.</li>
            </ul>
          </Note>
          <Note title="Threat model for a public URL checker">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Reads only the homepage, robots.txt, llms.txt and one linked pricing page. http(s) on standard ports only.</li>
              <li>Every resolved address must be public (private, loopback, link-local, CGNAT and mapped IPv6 ranges are blocked), with at most 3 redirects, a 6-second timeout and a 4 MB read cap.</li>
              <li>Six checks per minute per visitor, a daily cap, and a 10-minute cache per site.</li>
              <li>Known gap: the address is checked at DNS time, so DNS rebinding could race it. Pinning the IP with a custom dispatcher is the next step before this runs anywhere with an internal network.</li>
              <li>Nothing about the sites checked is stored beyond the in-memory cache.</li>
            </ul>
          </Note>
          <Note title="Crawler sources (checked October 2026)">
            <ul className="space-y-1.5">
              {[
                ["OpenAI: OAI-SearchBot, ChatGPT-User, GPTBot", "https://platform.openai.com/docs/bots"],
                ["Anthropic: Claude-SearchBot, Claude-User, ClaudeBot", "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"],
                ["Google: Googlebot, Google-Extended", "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers"],
                ["Google: AI features and nosnippet", "https://developers.google.com/search/docs/appearance/ai-features"],
                ["Perplexity: PerplexityBot, Perplexity-User", "https://docs.perplexity.ai/guides/bots"],
                ["Apple: Applebot-Extended", "https://support.apple.com/en-us/119829"],
                ["Common Crawl: CCBot", "https://commoncrawl.org/ccbot"],
                ["Meta: Meta-ExternalAgent", "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers"],
              ].map(([t, h]) => (
                <li key={h}>
                  <a className="link" href={h} target="_blank" rel="noreferrer">
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          </Note>
          <Note title="Questions I'd ask in week one">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Where do new users drop between submitting a URL and their first approved draft?</li>
              <li>What share of Free sign-ups ever see agent output?</li>
              <li>Which setup failure is most common in the logs?</li>
              <li>How does the feed decide which card comes first?</li>
            </ul>
          </Note>
        </div>
      </section>
    </div>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-popover">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold">
        {title}
        <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="px-5 pb-5 text-[15px] leading-6 text-muted">{children}</div>
    </details>
  );
}
