import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(admin.userId, admin.sessionId);
});

test("oficinas: abre directorio, aplica content-visibility y pagina contenido adicional", async ({
  page,
  context,
}) => {
  const islandErrors: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("_server-islands") && res.status() >= 400) {
      islandErrors.push(`${res.status()} ${res.url()} ${await res.text()}`);
    }
  });
  await setSessionCookie(context, admin.signedSessionId);
  await page.goto("/oficinas");

  const firstRow = page.locator("[data-master-detail-sort-item]").first();
  await expect(firstRow).toBeVisible({ timeout: 25_000 });

  if (islandErrors.length > 0) {
    throw new Error(`Server island failed: ${islandErrors.join(" | ")}`);
  }

  const cv = await firstRow.evaluate(
    (el) => getComputedStyle(el).contentVisibility,
  );
  expect(cv).toBe("auto");

  const page2Res = await page.request.get("/api/offices?page=2&limit=50", {
    headers: {
      cookie: `session_id=${admin.signedSessionId}`,
    },
  });
  expect(page2Res.ok()).toBe(true);
  const html = await page2Res.text();
  expect(html).toContain("data-master-detail-sort-item");
});

test("inventario de terminales: abre pantalla, hidrata Server Island y aplica content-visibility", async ({
  page,
  context,
}) => {
  await setSessionCookie(context, admin.signedSessionId);
  await page.goto("/inventario-terminales");

  const firstTerminalRow = page.locator("[data-terminal-row]").first();
  await expect(firstTerminalRow).toBeVisible({ timeout: 25_000 });

  const cv = await firstTerminalRow.evaluate(
    (el) => getComputedStyle(el).contentVisibility,
  );
  expect(cv).toBe("auto");

  const deepPageRes = await page.request.get(
    "/api/terminals?page=5&limit=50",
  );
  expect(deepPageRes.ok()).toBe(true);
});

test("supervisión y contenido histórico: cronograma, asistencia y auditoría cargan meses/registros anteriores", async ({
  page,
  context,
}) => {
  await setSessionCookie(context, admin.signedSessionId);

  const cronoRes = await page.request.get("/api/cronograma?month=2026-06");
  expect(cronoRes.ok()).toBe(true);
  const cronoJson = await cronoRes.json();
  expect(cronoJson.activeMonth).toBe("2026-06");
  expect(Array.isArray(cronoJson.operators)).toBe(true);

  const asistRes = await page.request.get(
    "/api/asistencia?startDate=2026-06-01&endDate=2026-06-15",
  );
  expect(asistRes.ok()).toBe(true);
  const asistJson = await asistRes.json();
  expect(Array.isArray(asistJson)).toBe(true);

  await page.goto("/admin/logs");
  const firstTimelineItem = page.locator("li.cv-auto-timeline").first();
  const count = await firstTimelineItem.count();
  if (count > 0) {
    const cv = await firstTimelineItem.evaluate(
      (el) => getComputedStyle(el).contentVisibility,
    );
    expect(cv).toBe("auto");
  }
});
