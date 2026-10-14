"use client";

import { useState } from "react";
import { btn } from "../styles";

/*
 * Fix #2 in one card: an Agents Feed draft that shows what approving costs,
 * why the agent wrote it, and what that does to the month. Credit costs and
 * the 2,000 monthly allowance are from Okara's docs (docs/credits); the draft
 * and the usage numbers are illustrative.
 */
const ALLOWANCE = 2000;
const DAY = 14;
const DAYS = 30;

const DRAFTS = [
  {
    id: "x",
    agent: "X agent",
    credits: 5,
    text: "Chasing a late invoice takes 4 emails on average. Quillmate sends them for you, politely, and stops the second the client pays.",
    why: [
      { doc: "brand-voice.md", note: "Short, direct sentences; talks to “you”" },
      { doc: "content-strategy.md", note: "Pillar: Invoices that chase themselves" },
    ],
  },
  {
    id: "reddit",
    agent: "Reddit agent",
    credits: 8,
    text: "r/freelance: “How do you get clients to pay on time?” Drafted reply shares a reminder schedule, with no link, because the subreddit bans self-promotion.",
    why: [
      { doc: "marketing-strategy.md", note: "Channel: communities where freelancers ask for help" },
      { doc: "brand-voice.md", note: "Never post a link without saying why it helps" },
    ],
  },
];

export function FeedCard() {
  const [used, setUsed] = useState(1240);
  const [done, setDone] = useState<Record<string, "approved" | "archived">>({});
  const perDay = used / DAY;
  const runOutDay = Math.floor(ALLOWANCE / perDay);
  const short = runOutDay < DAYS;
  const pct = Math.min(100, (used / ALLOWANCE) * 100);

  return (
    <div className="rounded-2xl border border-line bg-popover p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Agents Feed · prototype</p>
        <p className="text-[13px] text-muted">Credit costs from Okara&apos;s docs; draft and usage illustrative</p>
      </div>

      <div className="mt-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
          <p>
            <span className="font-semibold tabular-nums text-text">{used.toLocaleString("en-US")}</span>
            <span className="text-muted"> of {ALLOWANCE.toLocaleString("en-US")} credits used · day {DAY} of {DAYS}</span>
          </p>
          <p className={short ? "text-amber" : "text-aqua"}>{short ? `At this pace you run out on day ${runOutDay}, ${DAYS - runOutDay} days before reset` : "On pace to last the month"}</p>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-bg" role="img" aria-label={`${Math.round(pct)}% of monthly credits used`}>
          <div className={`h-full rounded-full ${short ? "bg-amber" : "bg-aqua"}`} style={{ width: `${pct}%` }} />
          <div className="absolute inset-y-0 w-px bg-text/60" style={{ left: `${(DAY / DAYS) * 100}%` }} title="Today" />
        </div>
        {short && <p className="mt-2 text-[13px] text-muted">Options before it happens: pause the agents you approve least, or top up (top-ups never expire).</p>}
      </div>

      <ul className="mt-5 space-y-3">
        {DRAFTS.map((d) => (
          <li key={d.id} className={`rounded-xl border border-line bg-card p-4 ${done[d.id] ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold text-text">{d.agent}</span>
              <span className="text-muted">{done[d.id] === "approved" ? "Approved" : done[d.id] === "archived" ? "Archived · 0 credits" : `${d.credits} credits to post`}</span>
            </div>
            <p className="mt-2 text-[15px] leading-6">{d.text}</p>
            <div className="mt-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">Why this</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {d.why.map((w) => (
                  <li key={w.doc} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted">
                    <span className="font-mono text-text">{w.doc}</span> · {w.note}
                  </li>
                ))}
              </ul>
            </div>
            {!done[d.id] && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn("primary", "sm")}
                  onClick={() => {
                    setUsed((u) => u + d.credits);
                    setDone((s) => ({ ...s, [d.id]: "approved" }));
                  }}
                >
                  Approve · {d.credits} credits
                </button>
                <button type="button" className={btn("outline", "sm")} onClick={() => setDone((s) => ({ ...s, [d.id]: "archived" }))}>
                  Archive
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
