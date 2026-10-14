/*
 * The five strategy documents, as far as one page of HTML can honestly get
 * them. Product information, brand voice and content strategy are built from
 * the site's own words right away. Marketing strategy and competitor analysis
 * need the full crawl and web search, so they say so and give an ETA instead
 * of a spinner.
 */
import type { PageFacts } from "./audit";

export type DocSection = { heading: string; body: string[]; source?: string };

export type StrategyDoc = {
  file: string;
  title: string;
  status: "ready" | "queued";
  /** Which Okara plan includes it today (docs/plans). */
  plan: "free" | "lite";
  /** For queued docs: what it still needs, in plain words. */
  waitingOn?: string;
  etaMin?: number;
  sections: DocSection[];
};

export type VoiceStats = {
  sentences: number;
  avgWords: number;
  you: number;
  we: number;
  exclamations: number;
  grade: number;
  samples: string[];
};

/** Sentences, split within each block so a heading never runs into the paragraph after it. */
export function sentencesOf(text: string) {
  return text
    .split("\n")
    .flatMap((block) => block.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => {
      const n = s.split(/\s+/).length;
      return n >= 4 && n <= 40 && /[a-z]/.test(s);
    });
}

function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export function voiceStats(text: string, paragraphs: string[] = []): VoiceStats {
  const sents = sentencesOf(text).slice(0, 200);
  const words = sents.flatMap((s) => s.split(/\s+/));
  const n = Math.max(1, sents.length);
  const wc = Math.max(1, words.length);
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  // Flesch–Kincaid grade level.
  const grade = Math.max(1, Math.round((0.39 * (wc / n) + 11.8 * (syl / wc) - 15.59) * 10) / 10);
  const count = (re: RegExp) => words.filter((w) => re.test(w)).length;
  // Quote body copy, not headings or card labels.
  const samples = (paragraphs.length ? sentencesOf(paragraphs.join("\n")) : sents)
    .filter((s) => s.length >= 30 && s.length <= 140 && s.split(/\s+/).length >= 6)
    .sort((a, b) => a.length - b.length)
    .slice(0, 3);
  return {
    sentences: sents.length,
    avgWords: Math.round((wc / n) * 10) / 10,
    you: count(/^(you|your|you're|yours)$/i),
    we: count(/^(we|our|we're|us)$/i),
    exclamations: sents.filter((s) => s.endsWith("!")).length,
    grade,
    samples,
  };
}

export function voiceRules(v: VoiceStats): string[] {
  const rules: string[] = [];
  rules.push(v.avgWords <= 14 ? `Short, direct sentences (about ${Math.round(v.avgWords)} words). Keep agent drafts the same.` : `Longer, explanatory sentences (about ${Math.round(v.avgWords)} words). Drafts can carry more detail, but split anything over 25 words.`);
  rules.push(v.you >= v.we ? "Talks to the reader as “you”. Lead with their problem, not your company." : "Talks about “we” more than “you”. Drafts should turn that around and lead with the reader.");
  rules.push(v.exclamations > 2 ? "Uses exclamation marks. Allowed, but no more than one per post." : "Calm, no exclamation marks. Keep it that way.");
  rules.push(v.grade <= 9 ? `Plain language (reading grade ${v.grade}).` : `Fairly technical (reading grade ${v.grade}). Fine for docs; simplify for social.`);
  return rules;
}

export function strategyDocs(p: PageFacts): StrategyDoc[] {
  const v = voiceStats(p.text, p.paragraphs);
  const what = p.description || p.firstParagraph || p.h1s[0] || "Not stated clearly on the homepage.";
  const product: StrategyDoc = {
    file: "product-information.md",
    title: "Product Information",
    status: "ready",
    plan: "free",
    sections: [
      { heading: "What it does", body: [what], source: p.description ? "meta description" : "homepage copy" },
      { heading: "Headline promise", body: [p.h1s[0] || "No main heading found."], source: "<h1>" },
      { heading: "Who it's for", body: [p.audience ? cap(p.audience) : "Not stated. Agents will have to infer it, which is how drafts end up generic."], source: p.audience ? "homepage copy" : undefined },
      { heading: "Pricing", body: [p.prices.length ? p.prices.join(" · ") : "No price on the homepage."], source: p.prices.length ? "homepage copy" : undefined },
      { heading: "Integrations", body: [p.integrations.length ? p.integrations.join(", ") : "None named on the homepage."] },
      { heading: "Proof", body: p.proof.length ? p.proof : ["No numbers yet."] },
      { heading: "Primary call to action", body: [p.ctas[0] ? `“${p.ctas[0]}”` : "None found."] },
    ],
  };
  const voice: StrategyDoc = {
    file: "brand-voice.md",
    title: "Brand Voice",
    status: "ready",
    plan: "lite",
    sections: [
      { heading: "How you sound today", body: voiceRules(v), source: `${v.sentences} sentences from your homepage` },
      { heading: "Lines that sound most like you", body: v.samples.length ? v.samples.map((s) => `“${s}”`) : ["Not enough copy in the HTML to quote."] },
      { heading: "Never", body: ["Claim numbers that aren't on your site.", "Use “revolutionary”, “game-changing” or “unlock”.", "Post a link without saying why it helps."] },
    ],
  };
  const pillars = p.h2s.slice(0, 5);
  const content: StrategyDoc = {
    file: "content-strategy.md",
    title: "Content Strategy",
    status: "ready",
    plan: "free",
    sections: [
      { heading: "Pillars, from your own page sections", body: pillars.length ? pillars : ["No section headings to build from."], source: "<h2> headings" },
      {
        heading: "First three pieces",
        body: [
          `“${p.name} pricing, explained”: a page assistants can quote${p.prices.length ? "" : " (you don't state a price yet)"}.`,
          `“${p.name} vs the usual alternative”: honest comparison with a table.`,
          pillars[0] ? `A how-to built on “${pillars[0]}”.` : "A how-to built on your most common support question.",
        ],
      },
    ],
  };
  return [
    product,
    {
      file: "marketing-strategy.md",
      title: "Marketing Strategy",
      status: "queued",
      plan: "free",
      waitingOn: "Okara's full crawl reads your pricing, docs and blog, then picks channels. This is where the AI pipeline takes over.",
      etaMin: 3,
      sections: [],
    },
    {
      file: "competitor-analysis.md",
      title: "Competitor Analysis",
      status: "queued",
      plan: "lite",
      waitingOn: "Searches the web for who you're compared with. Included on Lite and Pro.",
      etaMin: 4,
      sections: [],
    },
    voice,
    content,
  ];
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
