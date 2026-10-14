"use client";

import { useState } from "react";
import type { Check, Fix } from "@/lib/audit";
import { CodeBlock, CopyButton, pasteable } from "../code";
import { btn } from "../styles";

/** The hero of the results: one change, why it matters for this site, and the draft to ship. */
export function FixCard({ fix, check, site, compact = false }: { fix: Fix; check?: Check; site: string; compact?: boolean }) {
  const [pr, setPr] = useState(false);
  return (
    <article className={`rounded-2xl border ${compact ? "border-line bg-popover p-5" : "border-text/25 bg-card p-5 sm:p-6"}`}>
      {!compact && <p className="eyebrow">The one change that matters most for {site}</p>}
      <h3 className={`display ${compact ? "text-lg" : "mt-2 text-2xl leading-8"}`}>{fix.title}</h3>
      {check && (
        <div className="mt-2 space-y-2 text-[15px] leading-6">
          <p className="text-text">{check.detail}</p>
          {check.evidence && <p className="whitespace-pre-line break-words font-mono text-[13px] leading-5 text-muted">{check.evidence}</p>}
          <p className="text-muted">{check.why}</p>
        </div>
      )}
      <div className="mt-4">
        <CodeBlock code={fix.code} lang={fix.lang} label={`${fix.agent} agent · ${fix.where}`} />
      </div>
      <p className="mt-3 text-[13px] leading-5 text-muted">
        <span className="font-semibold text-text">Check before shipping:</span> {fix.review}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyButton text={pasteable(fix.code, fix.lang)} label="Copy the fix" kind={compact ? "outline" : "primary"} />
        <button type="button" className={btn("outline", "sm")} aria-expanded={pr} onClick={() => setPr((v) => !v)}>
          Ship it with the Coding agent
          <span className="rounded-full border border-line px-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Lite</span>
        </button>
      </div>
      {pr && (
        <p className="rise mt-3 rounded-xl border border-line bg-bg p-3 text-[13px] leading-5 text-muted">
          In Okara, this is where the Coding agent opens a GitHub pull request with exactly this change, for you to merge. Seeing and copying the fix stays free; having the agent ship it is the
          paid step, on Lite and Pro.
        </p>
      )}
      <p className="mt-3 text-[13px] text-muted">
        Okara already has this as a free tool:{" "}
        <a className="link" href={fix.tool.href} target="_blank" rel="noreferrer">
          {fix.tool.name}
          <span className="sr-only"> (opens okara.ai in a new tab)</span>
        </a>
        . Here it runs on your site, unprompted, in the first minute.
      </p>
    </article>
  );
}
