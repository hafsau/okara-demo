import type { AuditResult } from "./audit";

/** One line of the NDJSON stream from /api/audit. */
export type AuditEvent =
  | { t: "step"; id: StepId; status: "start" | "done" | "warn"; label: string; detail?: string; ms: number }
  | { t: "result"; result: AuditResult; ms: number; cached?: boolean }
  | { t: "error"; code: string; message: string; hint: string };

export type StepId = "read" | "fetch" | "robots" | "llms" | "pricing" | "checks";

export const ERROR_HINTS: Record<string, string> = {
  dns: "Check the spelling, or paste the address you'd type into a browser.",
  private: "Use the public address of your marketing site.",
  timeout: "Some sites are slow to answer automated visitors. Retry, or look at the example meanwhile.",
  status: "If the site loads in your browser, it may be refusing unknown bots.",
  blocked: "This site refuses unknown bots. That doesn't mean it blocks ChatGPT or Claude, which are verified separately.",
  too_large: "Try again later, or look at the example.",
  not_html: "Paste the address of a web page, not a file.",
  redirects: "Paste the address you end up on in a browser.",
  network: "Retry in a moment.",
  invalid: "Paste just the address, like yourproduct.com.",
  empty: "This page builds its text with JavaScript, so an HTML-only crawler reads almost nothing. That's a finding in itself.",
  rate: "You've run a lot of checks in a minute. Wait a moment, then retry.",
  busy: "The demo has hit its daily limit for live checks. The example shows the full flow.",
  internal: "Something broke on our side. Retry, or look at the example.",
};
