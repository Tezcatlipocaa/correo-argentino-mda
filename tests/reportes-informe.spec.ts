import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie } from "./helpers/auth";

let adminUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (adminUser) {
    await cleanupTestUser(adminUser.userId, adminUser.sessionId);
  }
});

test.describe("Informe Ejecutivo de Rediseño de Categorías (/reportes/categorias)", () => {
  test("muestra título ejecutivo, KPIs hero, secciones y tablas clave", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias");

    await expect(page.getByRole("heading", { name: "Rediseño del árbol de categorías" })).toBeVisible();

    await expect(page.getByText("52%").first()).toBeVisible();
    await expect(page.getByText("4,71").first()).toBeVisible();
    await expect(page.getByText("46%").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: /1\.\s*Radiografía:\s*dónde duele hoy/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /2\.\s*La demanda está concentrada/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /3\.\s*Casi la mitad del volumen/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /4\.\s*Tres formas de reordenar/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /5\.\s*Qué hace falta para aplicarlo/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /6\.\s*Dónde el rediseño NO ayuda/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /7\.\s*Resumen para la decisión/i })).toBeVisible();

    await expect(page.locator("table[data-testid='table-weak-points'], table:has-text('Desperdicio estructural')")).toBeVisible();
    await expect(page.locator("table[data-testid='table-pareto'], table:has-text('top 5 hojas')")).toBeVisible();
    await expect(page.locator("table[data-testid='table-closure-times'], table:has-text('1 minuto o menos')")).toBeVisible();
    await expect(page.locator("table[data-testid='table-comparison-matrix'], table:has-text('Nodos totales (hoy 719)')")).toBeVisible();
    await expect(page.locator("table[data-testid='table-decision-balance'], table:has-text('Situación hoy')")).toBeVisible();
  });

  test("permite alternar pantalla completa y salir con Escape", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias");

    const reportContainer = page.locator("#category-executive-report");
    const fullscreenBtn = page.locator("#btn-report-fullscreen");

    await expect(reportContainer).toBeVisible();
    await expect(fullscreenBtn).toBeVisible();

    // Estado inicial: no pantalla completa
    await expect(reportContainer).not.toHaveClass(/fullscreen-active/);

    // Activar pantalla completa
    await fullscreenBtn.click();
    await expect(reportContainer).toHaveClass(/fullscreen-active/);

    // Salir de pantalla completa mediante botón
    await fullscreenBtn.click();
    await expect(reportContainer).not.toHaveClass(/fullscreen-active/);

    // Volver a activar y salir con Escape
    await fullscreenBtn.click();
    await expect(reportContainer).toHaveClass(/fullscreen-active/);
    await page.keyboard.press("Escape");
    await expect(reportContainer).not.toHaveClass(/fullscreen-active/);
  });
});
