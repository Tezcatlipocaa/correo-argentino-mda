import { test, expect } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie } from "./helpers/auth";

let adminUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
  agentUser = await createTestUserAndSession("agent");
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test.describe("Módulo de Métricas de Workflows (/reportes/workflows)", () => {
  test("sin sesión redirige al login", async ({ context }) => {
    const res = await context.request.get("/reportes/workflows/implementacion", { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
  });

  test("usuario agent recibe 403 o redirección denegada", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const res = await context.request.get("/reportes/workflows/implementacion", { maxRedirects: 0 });
    expect([403, 302]).toContain(res.status());
  });

  test("admin accede a /reportes/workflows y es redirigido a implementacion", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/workflows");
    await expect(page).toHaveURL(/.*\/reportes\/workflows\/implementacion/);
  });

  test("admin interactúa con la tabla y abre el drawer con timeline", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/workflows/implementacion");

    await expect(
      page.getByRole("heading", { name: "Implementación, Cambio y Release" })
    ).toBeVisible();
    await expect(page.locator(".stat-value").first()).toBeVisible();
    await expect(page.locator("table#table-workflows")).toBeVisible();

    await page.locator(".btn-inspect-workflow").first().click();

    const drawer = page.locator("#workflow-timeline-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    await expect(page.locator("#drawer-steps-list")).toBeVisible();

    // Cierre del drawer con el botón de cerrar
    await page.locator("#drawer-close").click();
    await expect(drawer).toHaveClass(/translate-x-full/);

    // Reapertura y cierre con tecla Escape
    await page.locator(".btn-inspect-workflow").first().click();
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveClass(/translate-x-full/);
  });

  test("admin exporta CSV y acciona actualización en workflows", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/workflows/implementacion");

    // Verificar descarga de CSV
    const exportRes = await context.request.get("/api/reportes/workflows/implementacion/export");
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()["content-type"]).toContain("text/csv");
    const csvContent = await exportRes.text();
    expect(csvContent).toContain('"ID","Título","Estado"');

    // Verificar botón de actualización
    const refreshPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/reportes/workflows/implementacion/refresh") && resp.status() === 200,
    );
    await page.locator("#btn-refresh-workflows").click();
    const refreshResp = await refreshPromise;
    expect(refreshResp.status()).toBe(200);
  });
});
