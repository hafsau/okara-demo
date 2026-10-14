import { expect, test } from "@playwright/test";

for (const path of ["/", "/?example", "/teardown"]) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    if (path === "/?example") await expect(page.getByRole("heading", { name: "Quillmate" })).toBeVisible();
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
  });
}
