import { test, expect } from "@playwright/test";

test.describe("Office detail dropdown dynamic layout", () => {
  test("renders siblings in center column and compact assets when 3-column layout", async ({
    page,
  }) => {
    await page.goto("/oficinas");
    await page.waitForSelector("[data-office-id]", { timeout: 15000 });

    const article = page
      .locator("[data-master-detail-sort-item]:has([data-sibling-office])")
      .first();
    test.skip(
      (await article.count()) === 0,
      "No shared-address offices in the current DB",
    );

    await article.locator("[data-chevron-toggle]").click();
    await expect(article.locator("[data-sibling-office]").first()).toBeVisible();

    await expect(article.locator("[data-siblings-section]")).toBeVisible();

    const compactAssets = article.locator("[data-assets-compact]");
    const compactCount = await compactAssets.count();
    test.skip(
      compactCount === 0,
      "No expanded office with assets alongside siblings",
    );
    await expect(compactAssets.first()).toBeVisible();
  });
});
