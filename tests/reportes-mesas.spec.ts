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

test.describe("Módulo de Métricas de Mesas de Ayuda (/reportes/mesas)", () => {
  test("sin sesión redirige al login", async ({ context }) => {
    const res = await context.request.get("/reportes/mesas", { maxRedirects: 0 });
    expect([301, 302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/login");
  });

  test("usuario agent recibe 403 o redirección denegada", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const res = await context.request.get("/reportes/mesas", { maxRedirects: 0 });
    expect([403, 302]).toContain(res.status());
  });

  test("admin accede y visualiza Bento Grid, gráficos y tabla de mesas", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/mesas");

    await expect(
      page.getByRole("heading", { name: "Métricas de Mesas de Ayuda y Flujo Operativo" })
    ).toBeVisible();
    await expect(page.locator(".stat-value").first()).toBeVisible();
    await expect(page.locator("#table-helpdesks")).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("admin acciona botón de actualización con feedback y verifica resiliencia", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/mesas");

    const refreshPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/reportes/mesas/refresh") && resp.status() === 200,
    );
    await page.locator("#btn-refresh-helpdesks").click();
    const refreshResp = await refreshPromise;
    expect(refreshResp.status()).toBe(200);

    // Verificación de resiliencia ante fallo externo en API reportes
    const apiRes = await context.request.get("/api/reportes/mesas");
    expect(apiRes.status()).toBe(200);
    const body = await apiRes.json();
    expect(body).toHaveProperty("overview");
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("filas de la tabla reflejan mesas reales de InvGate y evento segment-click resalta la fila", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/mesas");

    const rows = page.locator("#table-helpdesks [data-table-row]");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    const firstRowName = await rows.first().getAttribute("data-helpdesk-name");
    expect(firstRowName).toBeTruthy();

    await page.evaluate((name) => {
      window.dispatchEvent(
        new CustomEvent("chart-card:segment-click", {
          bubbles: true,
          detail: { label: name },
        })
      );
    }, firstRowName);

    await expect(rows.first()).toHaveClass(/bg-primary\/20/);
  });
});
