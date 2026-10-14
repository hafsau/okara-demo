import { expect, test } from "@playwright/test";

test("the example ends on the crawler fix, with evidence and a diff", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Run the example" }).click();
  await expect(page).toHaveURL(/\?example$/);
  const term = page.getByRole("region", { name: "AI CMO Terminal" });
  await expect(term.getByText("Read robots.txt")).toBeVisible();
  await expect(page.getByText("8 of 16", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Let AI search engines back in" })).toBeVisible();
  await expect(page.getByText("robots.txt line 12: Disallow: / (OAI-SearchBot)").first()).toBeVisible();
  await expect(page.getByText("- Disallow: /    (line 12)")).toBeVisible();
  await expect(page.getByText("Also drafted (4)")).toBeVisible();
});

test("the paid step is explained, not hidden", async ({ page }) => {
  await page.goto("/?example");
  const ship = page.getByRole("button", { name: /Ship it with the Coding agent/ }).first();
  await ship.click();
  await expect(ship).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/Seeing and copying the fix stays free/)).toBeVisible();
});

test("'Fix drafted' opens that fix", async ({ page }) => {
  await page.goto("/?example");
  await page.getByRole("button", { name: "Fix drafted" }).nth(1).click();
  await expect(page.locator("details[open]")).toHaveCount(1);
});

test("training opt-outs are shown as a choice, not a failure", async ({ page }) => {
  await page.goto("/?example");
  await page.getByRole("tab", { name: "How AI assistants see you" }).click();
  await expect(page.getByText("Opting out is a fair choice and doesn't affect answers.")).toBeVisible();
  await expect(page.getByText("Blocked · line 9").first()).toBeVisible();
});

test("docs are honest about what's ready, previewed and queued", async ({ page }) => {
  await page.goto("/?example");
  await page.getByRole("tab", { name: "Strategy docs" }).click();
  await expect(page.getByText("Ready now · from your homepage")).toBeVisible();
  await page.getByRole("tab", { name: /Competitor Analysis/ }).click();
  await expect(page.getByText(/Arrives in about 4 min/)).toBeVisible();
  await page.getByRole("tab", { name: "Brand Voice" }).click();
  await expect(page.getByText(/The full brand voice .* is on Lite and Pro/)).toBeVisible();
});

test("messy input is cleaned up; bad input explained before any request", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Your website");
  await input.fill("https://www.Example.com/pricing?ref=nav");
  await expect(page.getByText("We'll read example.com (removed https://, reading the homepage, not /pricing, dropped the query string).")).toBeVisible();
  await input.fill("me@example.com");
  await page.getByRole("button", { name: /Check my site/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "looks like an email" })).toBeVisible();
});

test("teardown: approving a draft spends credits and moves the burn line", async ({ page }) => {
  await page.goto("/teardown");
  await expect(page.getByText("1,240", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve · 5 credits" }).click();
  await expect(page.getByText("1,245", { exact: true })).toBeVisible();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});

test("site is noindexed", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
});
