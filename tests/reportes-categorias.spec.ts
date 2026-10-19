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

  test("endpoint /api/reportes/categorias/node-details responde con metadatos y respeta RBAC", async ({ context }) => {
    const resAnon = await context.request.get(
      "/api/reportes/categorias/node-details?id=296&name=Denarius",
    );
    expect([401, 403]).toContain(resAnon.status());

    await setSessionCookie(context, agentUser.signedSessionId);
    const resAgent = await context.request.get(
      "/api/reportes/categorias/node-details?id=296&name=Denarius",
    );
    expect(resAgent.status()).toBe(403);

    await setSessionCookie(context, adminUser.signedSessionId);
    const resAdmin = await context.request.get(
      "/api/reportes/categorias/node-details?id=296&name=Denarius",
    );
    expect(resAdmin.status()).toBe(200);

    const json = await resAdmin.json();
    expect(json.id).toBe(296);
    expect(json.name).toBe("Denarius");
    expect(Array.isArray(json.kbArticles)).toBe(true);
    expect(json.invgateStatus).toEqual({
      existsInCatalog: true,
      catalogId: 296,
    });
  });

  test("Tier 3 & Tier 4: Inspector lateral unificado Drawer.tsx en árbol de categorías, sin duplicados, con posicionamiento bajo Navbar y bloqueo de scroll", async ({ context, page }) => {
    test.setTimeout(60000);
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias");

    // Cambiar a pestaña del Explorador de Árbol
    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("section[aria-label='Explorador del Árbol de Categorías']")).toBeVisible();

    // 1. Unicidad: verificar que no existen drawers duplicados ni el viejo inspector legacy
    expect(await page.locator("#category-inspector-drawer").count()).toBe(0);
    const drawers = page.locator("aside[role='dialog']");
    expect(await drawers.count()).toBe(1);

    const drawer = drawers.first();

    // Inicialmente cerrado
    await expect(drawer).toHaveClass(/translate-x-full/);

    // 2. Flujo de inspección: Clic en tarjeta de nodo en el árbol
    const nodeCard = page.locator(".will-change-transform .cursor-pointer, .will-change-transform [tabindex='0']").first();
    await expect(nodeCard).toBeVisible({ timeout: 15000 });
    await nodeCard.click();

    // 3. Drawer abierto y clases de posicionamiento
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/translate-x-0/);
    await expect(drawer).toHaveClass(/top-20/);
    await expect(drawer).toHaveClass(/h-\[calc\(100dvh-5rem\)\]/);

    // Header Navbar visible y no tapado
    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    // 4. Bloqueo de scroll en <main>
    const mainLocked = await page.evaluate(() => document.querySelector("main")?.style.overflow);
    expect(mainLocked).toBe("hidden");

    // 5. Contenido del drawer: Título "Detalle de Categoría" y bloque InvGate / KB
    await expect(drawer.locator("h3")).toContainText("Detalle de Categoría");
    await expect(drawer.getByText("Catálogo InvGate")).toBeVisible();

    // 6. Cierre con tecla Escape y restauración de scroll
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveClass(/translate-x-full/);

    const mainRestored = await page.evaluate(() => document.querySelector("main")?.style.overflow);
    expect(mainRestored).not.toBe("hidden");
  });
});



