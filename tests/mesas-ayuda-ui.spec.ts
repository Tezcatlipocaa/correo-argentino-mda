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

test("Los tópicos se muestran en mayúsculas", async ({ page }) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const badge = page.locator(".badge-secondary").first();
  if ((await badge.count()) === 0) {
    test.skip(true, "Sin tópicos en los datos de InvGate");
  }
  await expect(badge).toHaveClass(/uppercase/);
});

test("El contador de miembros de cada nivel tiene un divisor visible", async ({
  page,
}) => {
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const badge = page.locator("[data-level-badge]").first();
  if ((await badge.count()) === 0) {
    test.skip(true, "Sin niveles de atención en los datos de InvGate");
  }
  await expect(badge.locator("[data-level-divider]")).toHaveCount(1);
});

test("La fila de acciones envuelve sin desbordar en anchos angostos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/mesas-de-ayuda");
  await expect(page.locator("#soportes-search")).toBeVisible();

  const actions = page.locator(".card-actions").first();
  await expect(actions).toBeVisible();

  const flexWrap = await actions.evaluate((el) =>
    getComputedStyle(el).flexWrap,
  );
  expect(flexWrap).toBe("wrap");

  const overflows = await actions.evaluate((el) => {
    return el.scrollWidth > el.clientWidth + 1;
  });
  expect(overflows).toBe(false);
});
