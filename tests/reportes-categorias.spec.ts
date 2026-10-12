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

test.describe("Módulo de Auditoría de Categorías (/reportes/categorias)", () => {
  test("sin sesión redirige al login", async ({ context }) => {
    const res = await context.request.get("/reportes/categorias", { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
  });

  test("usuario agent recibe 403 o redirección denegada", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const res = await context.request.get("/reportes/categorias", { maxRedirects: 0 });
    expect([403, 302]).toContain(res.status());
  });

  test("admin accede y visualiza métricas y explorador interactivo", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias");

    await expect(page.getByRole("heading", { name: "Auditoría y Métricas del Árbol de Categorías" })).toBeVisible();
    await expect(page.locator(".stat-value").first()).toBeVisible();

    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("section[aria-label='Explorador del Árbol de Categorías']")).toBeVisible();
    await expect(page.locator("svg").first()).toBeVisible();
  });

  test("admin acciona botones de cambio de vista y refresco de categorías", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias");

    await page.locator('button[data-tab="explorer"]').click();

    const btnPropuesta = page.locator("#btn-view-propuesta");
    const btnActual = page.locator("#btn-view-actual");

    await expect(btnActual).toHaveClass(/btn-active/);
    await btnPropuesta.click();
    await expect(btnPropuesta).toHaveClass(/btn-active/);
    await expect(btnActual).not.toHaveClass(/btn-active/);

    await btnActual.click();
    await expect(btnActual).toHaveClass(/btn-active/);

    const refreshPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/reportes/categorias/refresh") && resp.status() === 200,
    );
    await page.locator("#btn-refresh-categories").click();
    const refreshResp = await refreshPromise;
    expect(refreshResp.status()).toBe(200);
  });

  test("navegación fluida entre pestañas (Informe, Explorador, Métricas)", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias");

    const tabReport = page.locator('button[data-tab="report"]');
    const tabExplorer = page.locator('button[data-tab="explorer"]');
    const tabMetrics = page.locator('button[data-tab="metrics"]');

    const panelReport = page.locator('[data-tab-panel="report"]');
    const panelExplorer = page.locator('[data-tab-panel="explorer"]');
    const panelMetrics = page.locator('[data-tab-panel="metrics"]');

    // Inicialmente informe activo
    await expect(tabReport).toHaveClass(/tab-active/);
    await expect(panelReport).toBeVisible();
    await expect(panelExplorer).toBeHidden();
    await expect(panelMetrics).toBeHidden();

    // Cambiar a Explorador de Árbol
    await tabExplorer.click();
    await expect(tabExplorer).toHaveClass(/tab-active/);
    await expect(tabReport).not.toHaveClass(/tab-active/);
    await expect(panelExplorer).toBeVisible();
    await expect(panelReport).toBeHidden();
    await expect(panelMetrics).toBeHidden();

    // Cambiar a Métricas y Concentración
    await tabMetrics.click();
    await expect(tabMetrics).toHaveClass(/tab-active/);
    await expect(tabExplorer).not.toHaveClass(/tab-active/);
    await expect(panelMetrics).toBeVisible();
    await expect(panelReport).toBeHidden();
    await expect(panelExplorer).toBeHidden();

    // Regresar a Informe
    await tabReport.click();
    await expect(tabReport).toHaveClass(/tab-active/);
    await expect(panelReport).toBeVisible();
    await expect(panelMetrics).toBeHidden();
  });
});
