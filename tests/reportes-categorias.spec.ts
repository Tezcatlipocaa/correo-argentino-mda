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

  test("inspector lateral abre con vínculo InvGate/KB y se cierra con backdrop y Escape", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias");

    const drawer = page.locator("#category-inspector-drawer");
    const backdrop = page.locator("#category-inspector-backdrop");
    const invgateBadge = page.locator("#inspect-invgate-badge");
    const kbContainer = page.locator("#inspect-kb-container");

    await expect(drawer).toHaveClass(/translate-x-full/);
    await expect(backdrop).toHaveClass(/opacity-0/);

    // Disparar apertura del inspector para un nodo
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("category:inspect", {
          detail: {
            node: {
              id: 296,
              name: "Denarius",
              path: "Sistemas > Denarius",
              totalTickets: 120,
              depth: 1,
              status: "active",
              anomalies: [],
              isLeaf: false,
            },
          },
        }),
      );
    });

    // Drawer y backdrop visibles
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    await expect(backdrop).toHaveClass(/opacity-100/);

    // Bloque InvGate & KB visible y actualizado
    await expect(page.getByText("Vínculo InvGate & KB")).toBeVisible();
    await expect(invgateBadge).toBeVisible();
    await expect(invgateBadge).toContainText("Catálogo ID: 296");
    await expect(kbContainer).toBeVisible();

    // Cerrar haciendo click en el backdrop
    await backdrop.click({ force: true });
    await expect(drawer).toHaveClass(/translate-x-full/);
    await expect(backdrop).toHaveClass(/opacity-0/);

    // Abrir nuevamente y cerrar con tecla Escape
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("category:inspect", {
          detail: {
            node: {
              id: 9999,
              name: "Categoria Externa",
              path: "Externa",
              totalTickets: 10,
              depth: 0,
              status: "active",
              anomalies: [],
              isLeaf: true,
            },
          },
        }),
      );
    });
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    await expect(backdrop).toHaveClass(/opacity-100/);

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveClass(/translate-x-full/);
    await expect(backdrop).toHaveClass(/opacity-0/);
  });
});


