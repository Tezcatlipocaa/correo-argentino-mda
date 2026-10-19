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

test.describe("Dashboard General de Métricas (/reportes)", () => {
  test("sin sesión redirige al login", async ({ context }) => {
    const res = await context.request.get("/reportes", { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
  });

  test("usuario agent recibe 403 o redirección denegada", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const res = await context.request.get("/reportes", { maxRedirects: 0 });
    expect([403, 302]).toContain(res.status());
  });

  test("admin accede y visualiza atajos rápidos y Bento Grid con los 6 widgets", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes");

    await expect(
      page.getByRole("heading", { name: "Centro de Métricas y Analítica" })
    ).toBeVisible();

    // Sección de atajos rápidos con QuickAccessCard en layout mini
    const shortcutsSection = page.locator('section[aria-label="Atajos rápidos a reportes"]');
    await expect(shortcutsSection).toBeVisible();
    await expect(shortcutsSection.getByText("Árbol de Categorías")).toBeVisible();
    await expect(shortcutsSection.getByText("Flujo de Mesas")).toBeVisible();
    await expect(shortcutsSection.getByText("Workflows de Proceso")).toBeVisible();
    await expect(shortcutsSection.getByText("Red de Oficinas")).toBeVisible();
    await expect(shortcutsSection.getByText("Inventario de Terminales")).toBeVisible();
    await expect(shortcutsSection.getByText("Automatizaciones")).toBeVisible();

    // Sección de widgets Bento
    const bentoSection = page.locator('section[aria-label="Widgets de resumen y analítica"]');
    await expect(bentoSection).toBeVisible();
    await expect(bentoSection.getByText("Categorías")).toBeVisible();
    await expect(bentoSection.getByText("Mesas de Ayuda")).toBeVisible();
    await expect(bentoSection.getByText("Workflows de Proceso")).toBeVisible();
    await expect(bentoSection.getByText("Red de Oficinas")).toBeVisible();
    await expect(bentoSection.getByText("Inventario de Terminales")).toBeVisible();
    await expect(bentoSection.getByText("Centro de Automatizaciones")).toBeVisible();

    // Botones "Ver más"
    const moreButtons = bentoSection.getByRole("link", { name: /Ver más/i });
    await expect(moreButtons).toHaveCount(6);
  });

  test("el atajo de Métricas en la sidebar navega a /reportes", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/");

    const sidebarMetricsLink = page.locator('aside a[href*="/reportes"]').first();
    await expect(sidebarMetricsLink).toBeVisible();
    await sidebarMetricsLink.click();

    await expect(page).toHaveURL(/.*\/reportes/);
    await expect(
      page.getByRole("heading", { name: "Centro de Métricas y Analítica" })
    ).toBeVisible();
  });
});
