import { test, expect } from "@playwright/test";
import { getCleanBase } from "../src/lib/baseUrl";

test.describe("Normalización de URLs base", () => {
  const base = getCleanBase();

  test("Página 404 tiene enlace a home con cleanBase", async ({ page }) => {
    await page.goto("/404-test-non-existing-path");
    const homeBtn = page.getByRole("link", { name: "Volver al inicio" });
    await expect(homeBtn).toBeVisible();
    await expect(homeBtn).toHaveAttribute("href", base);
  });
});
