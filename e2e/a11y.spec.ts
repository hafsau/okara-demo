import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("home, before a run", async ({ page }) => {
  await page.goto("/");
  await axe(page);
});

test("home, example results in every tab", async ({ page }) => {
  await page.goto("/?example");
  await expect(page.getByRole("heading", { name: "Quillmate" })).toBeVisible();
  await axe(page);
  await page.getByRole("tab", { name: "How AI assistants see you" }).click();
  await axe(page);
  await page.getByRole("tab", { name: "Strategy docs" }).click();
  await axe(page);
});

test("teardown, with notes open", async ({ page }) => {
  await page.goto("/teardown");
  for (const s of await page.locator("details > summary").all()) await s.click();
  await axe(page);
});
