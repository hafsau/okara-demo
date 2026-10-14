import type { AuditEvent } from "@/lib/events";

export type TermLine = Extract<AuditEvent, { t: "step" }>;

const ICON: Record<TermLine["status"], { glyph: string; cls: string; sr: string }> = {
  start: { glyph: "›", cls: "text-muted", sr: "In progress" },
  done: { glyph: "✓", cls: "text-aqua", sr: "Done" },
  warn: { glyph: "!", cls: "text-amber", sr: "Needs attention" },
};

/** Okara's "AI CMO Terminal", reused: every step appears the moment it starts. */
export function Terminal({ lines, state, elapsed, example }: { lines: TermLine[]; state: "running" | "done" | "error"; elapsed: number; example: boolean }) {
  return (
    <section aria-labelledby="term-title" className="rounded-2xl border border-line bg-popover">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id="term-title" className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted">
          AI CMO Terminal
        </h2>
        <span className="font-mono text-[13px] tabular-nums text-muted" aria-label={`${(elapsed / 1000).toFixed(1)} seconds`}>
          {(elapsed / 1000).toFixed(1)}s
        </span>
      </div>
      {/* Height reserved for a typical run, so streamed lines don't push the results down. */}
      <ol className="min-h-[15.5rem] space-y-2 px-4 py-4 font-mono text-[13px] leading-5">
        {lines.map((l) => {
          const icon = ICON[l.status];
          return (
            <li key={l.id} className="rise grid grid-cols-[1rem_1fr_auto] gap-x-2">
              <span className={icon.cls} aria-hidden="true">
                {icon.glyph}
              </span>
              <span className="sr-only">{icon.sr}: </span>
              <span className="min-w-0">
                <span className="text-text">{l.label}</span>
                {l.status === "start" && <span className="caret text-muted" aria-hidden="true"> ▍</span>}
                {l.detail && <span className="block break-words text-muted">{l.detail}</span>}
              </span>
              <span className="tabular-nums text-dim">{l.status === "start" ? "" : `${(l.ms / 1000).toFixed(1)}s`}</span>
            </li>
          );
        })}
        {state === "running" && lines.length === 0 && <li className="text-muted">Starting…</li>}
      </ol>
      {example && <p className="border-t border-line px-4 py-2.5 text-[13px] text-muted">Example timings are paced so you can follow them. Live checks show real ones.</p>}
    </section>
  );
}
