import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import { users, sessions, mesas } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

function host(): string {
  return test.info().project.use.baseURL ?? "http://localhost:4321";
}

test.describe("Búsqueda y filtros en /admin/usuarios/mesas-de-ayuda (#218)", () => {
  let adminCookie: string;
  let adminSession: string;
  let adminId: number;

  const testActiveMesa = `Test Active Mesa ${Date.now()}`;
  const testInactiveMesa = `Test Inactive Mesa ${Date.now()}`;
  let testActiveInvgateId: number;
  let testInactiveInvgateId: number;

  test.beforeAll(async () => {
    const ts = Date.now();
    adminSession = `admin-mesas-search-${ts}`;
    const [u] = await db
      .insert(users)
      .values({
        username: `admin_search_${ts}`,
        password: "hash",
        role: "admin",
      })
      .returning({ id: users.id });
    adminId = u.id;
    await db.insert(sessions).values({
      id: adminSession,
      userId: adminId,
      expiresAt: Date.now() + 86400000,
    });
    adminCookie = sign(adminSession);

    testActiveInvgateId = 980000 + (ts % 10000);
    testInactiveInvgateId = 990000 + (ts % 10000);

    await db.insert(mesas).values([
      {
        invgateId: testActiveInvgateId,
        name: testActiveMesa,
        active: true,
        assignable: true,
        lastSyncedAt: new Date().toISOString(),
      },
      {
        invgateId: testInactiveInvgateId,
        name: testInactiveMesa,
        active: false,
        assignable: false,
        lastSyncedAt: new Date().toISOString(),
      },
    ]);
  });

  test.afterAll(async () => {
    await db.delete(mesas).where(eq(mesas.invgateId, testActiveInvgateId));
    await db.delete(mesas).where(eq(mesas.invgateId, testInactiveInvgateId));
    await db.delete(sessions).where(eq(sessions.id, adminSession));
    await db.delete(users).where(eq(users.id, adminId));
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "session_id",
        value: adminCookie,
        domain: "localhost",
        path: "/",
      },
      {
        name: "mda_session",
        value: adminCookie,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("renderiza la barra de búsqueda y los botones de filtro", async ({
    page,
  }) => {
    await page.goto(`${host()}/admin/usuarios/mesas-de-ayuda`);
    await expect(page.locator("#permisos-root")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("#mesas-search")).toBeVisible();
    await expect(page.locator("#mesas-filter-group")).toBeVisible();
    await expect(page.locator("#mesas-count-badge")).toBeVisible();
  });

  test("búsqueda reactiva filtra por nombre e InvGate ID", async ({ page }) => {
    await page.goto(`${host()}/admin/usuarios/mesas-de-ayuda`);
    await expect(page.locator("#permisos-root")).toBeVisible({
      timeout: 15000,
    });

    const searchInput = page.locator("#mesas-search");
    await searchInput.fill(testActiveMesa);

    const activeRow = page.locator(
      `#mesas-table article[data-table-row]:has-text("${testActiveMesa}")`,
    );
    await expect(activeRow).toBeVisible();

    const inactiveRow = page.locator(
      `#mesas-table article[data-table-row]:has-text("${testInactiveMesa}")`,
    );
    await expect(inactiveRow).toBeHidden();

    await searchInput.fill(String(testInactiveInvgateId));
    await expect(activeRow).toBeHidden();
    await expect(inactiveRow).toBeVisible();
  });

  test("filtros por estado muestran y ocultan mesas según corresponda", async ({
    page,
  }) => {
    await page.goto(`${host()}/admin/usuarios/mesas-de-ayuda`);
    await expect(page.locator("#permisos-root")).toBeVisible({
      timeout: 15000,
    });

    const inactiveFilterBtn = page.locator(
      '#mesas-filter-group button[data-filter-value="inactive"]',
    );
    await inactiveFilterBtn.click();

    const inactiveRow = page.locator(
      `#mesas-table article[data-table-row]:has-text("${testInactiveMesa}")`,
    );
    await expect(inactiveRow).toBeVisible();

    const activeRow = page.locator(
      `#mesas-table article[data-table-row]:has-text("${testActiveMesa}")`,
    );
    await expect(activeRow).toBeHidden();

    const assignableFilterBtn = page.locator(
      '#mesas-filter-group button[data-filter-value="assignable"]',
    );
    await assignableFilterBtn.click();
    await expect(activeRow).toBeVisible();
    await expect(inactiveRow).toBeHidden();
  });

  test("muestra empty state cuando no hay coincidencias y botón restablece", async ({
    page,
  }) => {
    await page.goto(`${host()}/admin/usuarios/mesas-de-ayuda`);
    await expect(page.locator("#permisos-root")).toBeVisible({
      timeout: 15000,
    });

    const searchInput = page.locator("#mesas-search");
    await searchInput.fill("NON_EXISTING_MESA_XYZ_9999");

    const emptyState = page.locator("#mesas-table-empty-state");
    await expect(emptyState).toBeVisible();

    const clearBtn = page.locator("#mesas-search-clear");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(emptyState).toBeHidden();
    await expect(searchInput).toHaveValue("");
  });
});
