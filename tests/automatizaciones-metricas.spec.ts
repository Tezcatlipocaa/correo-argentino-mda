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
      await expect(page.getByText("Casos por mes")).toBeVisible();
      await expect(page.getByText("Backlog por antigüedad")).toBeVisible();
    }
  });

  test("sin sesión redirige a login", async ({ request }) => {
    const response = await request.get("/automatizaciones/metricas", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toContain("/login");
  });
});
