"use client";

import { useState } from "react";
import type { StrategyDoc } from "@/lib/docs";
import { pill } from "../styles";

/** The five strategy docs, in okara.ai's pill switcher. Ready now, preview, or honestly queued. */
export function DocsView({ docs }: { docs: StrategyDoc[] }) {
  const [active, setActive] = useState(0);
  const doc = docs[active];
  const preview = doc.status === "ready" && doc.plan === "lite";
  const sections = preview ? doc.sections.slice(0, 1) : doc.sections;
  return (
    <div>
      <p className="text-[15px] leading-6 text-muted">
        Every agent reads these before it writes a word. Three are built from your homepage right now. The other two need Okara&apos;s full crawl and arrive a few minutes later.
      </p>
      <div role="tablist" aria-label="Strategy documents" className="mt-4 flex flex-wrap gap-2">
        {docs.map((d, i) => (
          <button
            key={d.file}
            role="tab"
            id={`doc-tab-${i}`}
            aria-selected={i === active}
            aria-controls="doc-panel"
            onClick={() => setActive(i)}
            className={pill(i === active)}
          >
            {d.title}
            {d.status === "queued" && <span className={`ml-2 h-1.5 w-1.5 rounded-full ${i === active ? "bg-bg" : "bg-muted"}`} aria-label="(arrives later)" />}
          </button>
        ))}
      </div>
      <section id="doc-panel" role="tabpanel" aria-labelledby={`doc-tab-${active}`} className="mt-4 rounded-2xl border border-line bg-popover p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[13px] text-muted">{doc.file}</p>
          <p className="text-[13px] text-muted">
            {doc.status === "queued" ? `Arrives in about ${doc.etaMin} min` : "Ready now · from your homepage"}
            {doc.plan === "lite" && " · Lite and Pro"}
          </p>
        </div>
        {doc.status === "queued" ? (
          <div className="mt-4">
            <p className="display text-xl">{doc.title}</p>
            <p className="mt-2 max-w-prose text-[15px] leading-6 text-muted">{doc.waitingOn}</p>
            <p className="mt-3 text-[13px] text-dim">You&apos;ll get a notification when it lands. Your fix and the three docs above don&apos;t wait for it.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {sections.map((s) => (
              <div key={s.heading}>
                <h4 className="text-[15px] font-semibold text-text">{s.heading}</h4>
                <ul className="mt-1.5 space-y-1 text-[15px] leading-6 text-muted">
                  {s.body.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {s.source && <p className="mt-1 text-[12px] text-dim">From: {s.source}</p>}
              </div>
            ))}
            {preview && (
              <p className="rounded-xl border border-line bg-bg px-4 py-3 text-[13px] leading-5 text-muted">
                That&apos;s the first section. The full brand voice (your best lines, the words to never use) is on Lite and Pro.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
