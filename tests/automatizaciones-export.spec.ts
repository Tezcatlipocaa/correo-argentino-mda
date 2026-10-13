import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * Export del reporte de métricas de /automatizaciones (CSV y PNG):
 * requiere sesión iniciada.
 */

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
});

test.afterAll(async () => {
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test.describe("Export de métricas de /automatizaciones", () => {
  test("CSV sin sesión devuelve 401", async ({ request }) => {
    const response = await request.get(
      "/api/automatizaciones/metrics/export.csv",
    );
    expect(response.status()).toBe(401);
  });

  test("PNG sin sesión devuelve 401", async ({ request }) => {
    const response = await request.get(
      "/api/automatizaciones/metrics/export.png",
    );
    expect(response.status()).toBe(401);
  });

  test("CSV con sesión devuelve text/csv", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const response = await context.request.get(
      "/api/automatizaciones/metrics/export.csv",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
  });

  test("PNG con sesión devuelve image/png", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const response = await context.request.get(
      "/api/automatizaciones/metrics/export.png",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("CSV del listado sin sesión devuelve 401", async ({ request }) => {
    const response = await request.get("/api/automatizaciones/export.csv");
    expect(response.status()).toBe(401);
  });

  test("CSV del listado con sesión devuelve text/csv", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const response = await context.request.get(
      "/api/automatizaciones/export.csv?status=active",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
  });
});
