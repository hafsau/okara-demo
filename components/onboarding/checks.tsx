import type { Check, Fix } from "@/lib/audit";

const GROUPS: { id: Check["group"]; title: string }[] = [
  { id: "ai", title: "Showing up in AI answers" },
  { id: "seo", title: "Search basics" },
];

function Status({ c }: { c: Check }) {
  if (c.unknown) return <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-line text-[11px] text-muted" title="Couldn't check">?<span className="sr-only">Couldn&apos;t check</span></span>;
  if (c.pass) return <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-aqua/15 text-[12px] text-aqua">✓<span className="sr-only">Passes</span></span>;
  const tone = c.severity === "high" ? "bg-red/15 text-red" : c.severity === "medium" ? "bg-amber/15 text-amber" : "bg-line text-muted";
  return <span className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-bold ${tone}`}>!<span className="sr-only">{c.severity} priority issue</span></span>;
}

export function Checks({ checks, fixes, onShowFix }: { checks: Check[]; fixes: Fix[]; onShowFix: (id: Fix["id"]) => void }) {
  const order = (c: Check) => (c.unknown ? 3 : c.pass ? 4 : { high: 0, medium: 1, low: 2 }[c.severity]);
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const list = checks.filter((c) => c.group === g.id).sort((a, b) => order(a) - order(b));
        const pass = list.filter((c) => c.pass && !c.unknown).length;
        return (
          <section key={g.id} aria-labelledby={`g-${g.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 id={`g-${g.id}`} className="display text-lg">
                {g.title}
              </h3>
              <p className="text-[13px] text-muted">
                {pass} of {list.filter((c) => !c.unknown).length} pass
              </p>
            </div>
            <ul className="mt-3 divide-y divide-line-soft rounded-2xl border border-line bg-popover">
              {list.map((c) => {
                const fix = c.fixId && !c.pass ? fixes.find((f) => f.id === c.fixId) : undefined;
                return (
                  <li key={c.id} className="flex gap-3 px-4 py-3.5">
                    <Status c={c} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="font-semibold text-text">{c.label}</p>
                        {fix && (
                          <button type="button" onClick={() => onShowFix(fix.id)} className="rounded-full border border-aqua/40 px-2 py-0.5 text-[12px] font-medium text-aqua hover:border-aqua">
                            Fix drafted
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-[14px] leading-6 text-muted">{c.detail}</p>
                      {c.evidence && !c.pass && <p className="mt-1 whitespace-pre-line break-words font-mono text-[12px] leading-5 text-dim">{c.evidence}</p>}
                      {!c.pass && !c.unknown && <p className="mt-1 text-[13px] leading-5 text-dim">{c.why}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
