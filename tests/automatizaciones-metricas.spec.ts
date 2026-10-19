import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * Página de métricas de /automatizaciones:
 * - Acceso de lectura para cualquier usuario con sesión iniciada.
 * - Render de KPIs/secciones cuando hay historial local.
 * - Redirect a login sin sesión.
 */

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
});

test.afterAll(async () => {
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test.describe("Métricas de /automatizaciones", () => {
  test("agent accede a /automatizaciones/metricas", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const response = await context.request.get("/automatizaciones/metricas", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
  });

  test("renderiza el header y KPIs o el estado vacío", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones/metricas");

    await expect(
      page.getByRole("heading", { name: "Métricas de automatizaciones" }),
    ).toBeVisible();

    const kpi = page.getByText("Total histórico");
    const empty = page.getByText(/Todavía no hay historial/);
    await expect(kpi.or(empty).first()).toBeVisible();

    if (await kpi.isVisible().catch(() => false)) {
      await expect(page.getByText("Resumen ejecutivo")).toBeVisible();
      await expect(page.getByText("Casos por mes")).toBeVisible();
      await expect(page.getByText("Backlog por antigüedad")).toBeVisible();
      await expect(page.getByText("Por mesa")).toHaveCount(0);
      await expect(page.getByText("Cierre por el portal")).toHaveCount(0);
    }
  });

  test("renderiza los gráficos (líneas y donuts)", async ({ context, page }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones/metricas");

    const kpi = page.getByText("Total histórico");
    test.skip((await kpi.count()) === 0, "Sin historial cargado.");

    await expect(
      page.getByRole("img", {
        name: "Casos creados y finalizados por mes",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Tiempo de ciclo mediano por mes",
        exact: true,
      }),
    ).toBeVisible();
  });

  // El módulo está bajo <ClientRouter /> (BaseLayout inyecta view transitions
  // en /automatizaciones/**), así que la navegación real es client-side: el
  // router hace fetch del destino y, si esa página falla al renderizar, aborta
  // la navegación sin mostrar error. Un `page.goto` no cubre ese camino.
  test("el botón Métricas navega a la página y la renderiza", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones");

    const metricsLink = page.locator('a[href$="/automatizaciones/metricas"]');
    await expect(metricsLink).toHaveCount(1);
    await metricsLink.click();

    await expect(page).toHaveURL(/\/automatizaciones\/metricas$/);
    await expect(
      page.getByRole("heading", { name: "Métricas de automatizaciones" }),
    ).toBeVisible();
  });

  test("sin sesión redirige a login", async ({ request }) => {
    const response = await request.get("/automatizaciones/metricas", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toContain("/login");
  });
});
