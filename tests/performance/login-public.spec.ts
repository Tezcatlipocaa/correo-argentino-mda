import { test, expect } from "@playwright/test";

test("login page does not load authenticated modals", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await page.goto("/login");

  await expect(page.locator("#command-palette")).toHaveCount(0);

  const modalChunks = requests.filter((u) =>
    /commandPaletteModal|feedbackModal|aboutProjectModal/i.test(u),
  );
  expect(modalChunks).toHaveLength(0);
});
