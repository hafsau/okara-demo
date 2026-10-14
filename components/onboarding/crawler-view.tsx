import type { AuditResult, Tier } from "@/lib/audit";

const TIERS: { id: Tier; title: string; note: string }[] = [
  { id: "search", title: "Search and answers", note: "These decide whether you can be found and cited." },
  { id: "user", title: "Opening links for someone", note: "Fetched when a person asks an assistant about a page. Providers say robots.txt may not apply." },
  { id: "training", title: "Model training", note: "Opting out is a fair choice and doesn't affect answers." },
];

/** "How AI assistants see you": the raw HTML a crawler reads, next to what a person sees. */
export function CrawlerView({ r }: { r: AuditResult }) {
  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-line bg-popover px-4 py-3 text-[13px] leading-5 text-muted">
        In Okara today, GEO visibility is on paid plans. This preview uses only what&apos;s public on your homepage, so it can run before sign-up.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="see-you" className="rounded-2xl border border-line bg-popover p-5">
          <h3 id="see-you" className="eyebrow">
            What a person sees first
          </h3>
          <p className="display mt-3 text-xl leading-7">{r.page.h1s[0] || r.page.title || "No main heading"}</p>
          <p className="mt-2 text-[15px] leading-6 text-muted">{r.page.description || r.page.firstParagraph || "No description."}</p>
        </section>
        <section aria-labelledby="see-bot" className="rounded-2xl border border-line bg-popover p-5">
          <h3 id="see-bot" className="eyebrow">
            What an HTML-only crawler reads · {r.page.words.toLocaleString("en-US")} words
          </h3>
          <p className="mt-3 max-h-48 overflow-auto break-words font-mono text-[12px] leading-5 text-muted" tabIndex={0}>
            {r.excerpt || "(nothing)"}
          </p>
        </section>
      </div>

      <section aria-labelledby="facts">
        <h3 id="facts" className="display text-lg">
          The spec sheet an assistant can build from your homepage
        </h3>
        <dl className="mt-3 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {[
            ["Who it's for", r.page.audience],
            ["Price", r.page.prices.join(" · ")],
            ["Integrations", r.page.integrations.join(", ")],
            ["Proof", r.page.proof.join("; ")],
            ["Structured data", r.page.jsonLdTypes.join(", ")],
            ["Main call to action", r.page.ctas[0]],
          ].map(([k, v]) => (
            <div key={k} className="bg-popover px-4 py-3">
              <dt className="text-[13px] text-muted">{k}</dt>
              <dd className={`mt-0.5 text-[15px] ${v ? "text-text" : "text-amber"}`}>{v || "Missing: an assistant would have to guess"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="bots">
        <h3 id="bots" className="display text-lg">
          Who robots.txt lets in
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          {r.robots.status === "missing" ? "There's no robots.txt, so everyone is allowed." : r.robots.status === "unreadable" ? "robots.txt didn't load, so this is unknown." : "Read from your robots.txt just now."}
        </p>
        <div className="mt-3 space-y-4">
          {TIERS.map((t) => (
            <div key={t.id} className="rounded-2xl border border-line bg-popover p-4 sm:p-5">
              <p className="font-semibold">{t.title}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-muted">{t.note}</p>
              <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {r.robots.bots
                  .filter((b) => b.tier === t.id)
                  .map((b) => (
                    <li key={b.ua} className="flex items-start justify-between gap-3 text-[13px]">
                      <span className="min-w-0">
                        <span className="break-all font-mono text-text">{b.ua}</span>
                        <span className="block text-muted">{b.who}</span>
                      </span>
                      <span
                        className={`flex-none rounded-full px-2 py-0.5 text-[12px] font-medium ${
                          r.robots.status === "unreadable" ? "bg-line text-muted" : b.allowed ? "bg-aqua/15 text-aqua" : t.id === "search" ? "bg-red/15 text-red" : "bg-line text-muted"
                        }`}
                      >
                        {r.robots.status === "unreadable" ? "Unknown" : b.allowed ? "Allowed" : b.line ? `Blocked · line ${b.line}` : "Blocked"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {r.notes.map((n) => (
          <p key={n} className="mt-3 rounded-xl border border-amber/30 px-4 py-3 text-[13px] leading-5 text-muted">
            {n}
          </p>
        ))}
        <p className="mt-3 text-[13px] text-dim">Crawler names and tiers from OpenAI, Anthropic, Google, Perplexity, Apple, Common Crawl and Meta crawler docs, checked October 2026.</p>
      </section>
    </div>
  );
}
