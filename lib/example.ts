/*
 * A bundled example site, so the flow works with no network: for reviewers
 * in a hurry, for tests, and as the fallback when a real fetch fails.
 * Quillmate is fictional. Its HTML has the gaps real small-SaaS homepages
 * usually have: no meta description, no share image, no structured data,
 * no llms.txt, and a robots.txt that opts out of AI training on purpose and,
 * by copying a gist, out of ChatGPT search and Perplexity answers by accident.
 */

export const EXAMPLE = {
  id: "quillmate",
  url: "https://quillmate.example/",
  display: "quillmate.example",
  robots: `User-agent: *
Allow: /

# "Block AI scrapers", pasted from a gist in 2024
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Google-Extended
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: PerplexityBot
Disallow: /
`,
  llms: null as string | null,
  html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quillmate | Invoicing for freelancers who'd rather be working</title>
  <meta property="og:title" content="Quillmate">
  <link rel="canonical" href="https://quillmate.example/">
</head>
<body>
  <header>
    <a href="/">Quillmate</a>
    <nav>
      <a href="/pricing">Pricing</a>
      <a href="/features">Features</a>
      <a href="/integrations">Integrations</a>
      <a href="/blog">Blog</a>
      <a href="/login">Log in</a>
      <a href="/signup">Start free</a>
    </nav>
  </header>
  <main>
    <h1>Get paid on time without chasing anyone</h1>
    <p>Quillmate sends your invoices, reminds clients for you and reconciles payments, so freelancers spend their Fridays working instead of chasing money.</p>
    <a href="/signup">Start free</a>
    <a href="/demo">Watch a 2-minute demo</a>
    <p>Trusted by 8,000+ freelancers in 40 countries.</p>
    <img src="/hero.png" alt="An invoice marked paid">
    <img src="/logos.png">

    <h2>Invoices that chase themselves</h2>
    <p>Set a reminder schedule once. Quillmate nudges late clients politely, and stops the moment they pay.</p>

    <h2>Every way your clients pay</h2>
    <p>Card, bank transfer and PayPal, through Stripe. Payments land in QuickBooks or Xero already matched to the right invoice.</p>

    <h2>Know what you'll earn this month</h2>
    <p>See what's paid, what's due and what's late, on one screen. No spreadsheet.</p>

    <h2>Simple pricing</h2>
    <p>Free for your first 3 clients. Then $12/mo for unlimited clients and reminders. Cancel any time, in one click.</p>

    <h2>Questions freelancers ask</h2>
    <p>Do my clients need an account? No. They pay from a link in the email.</p>
    <p>Can I use my own branding? Yes, on every plan.</p>
  </main>
  <footer>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </footer>
</body>
</html>`,
};
