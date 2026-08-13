import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

let adminUser: TestUser;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, adminUser.signedSessionId);
});

test("Los iconos sobreviven al filtrado (sin referencias <use> huerfanas)", async ({
  page,
}) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  await expect(page.locator("svg[data-icon]")).not.toHaveCount(0);

  await page.locator("#filter-status").selectOption("active");

  const orphanedUses = await page.evaluate(() => {
    const ids = new Set(
      Array.from(document.querySelectorAll("symbol")).map((s) => s.id),
    );
    return Array.from(document.querySelectorAll("use")).filter((u) => {
      const href = u.getAttribute("href") || "";
      return href.startsWith("#") && !ids.has(href.slice(1));
    }).length;
  });
  expect(orphanedUses).toBe(0);
});
