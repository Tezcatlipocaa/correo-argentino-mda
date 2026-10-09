import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/db/index";
import { sessions, users } from "../../src/db/schema";

const SECRET_KEY = process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";
function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

test.describe("Endpoint de estadísticas de usuarios (#183)", () => {
  const stamp = Date.now();
  const sessionId = `sess_stats_${stamp}`;
  const username = `admin_stats_${stamp}`;
  let adminId = 0;
  let cookie = "";

  test.beforeAll(async () => {
    const [row] = await db
      .insert(users)
      .values({ username, password: "x", role: "admin" })
      .returning({ id: users.id });
    adminId = row.id;
    await db.insert(sessions).values({
      id: sessionId,
      userId: adminId,
      expiresAt: Date.now() + 86_400_000,
    });
    cookie = sign(sessionId);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, adminId));
    await db.delete(users).where(eq(users.id, adminId));
  });

  test("sin sesión responde 401", async ({ request }) => {
    const response = await request.get("/api/admin/usuarios/estadisticas");
    expect(response.status()).toBe(401);
  });

  test("con sesión admin devuelve KPIs y las tres series", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/admin/usuarios/estadisticas?activo=true",
      { headers: { cookie: `session_id=${cookie}` } },
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.kpis).toMatchObject({
      total: expect.any(Number),
      activos: expect.any(Number),
      inactivos: expect.any(Number),
      enAsistencia: expect.any(Number),
    });
    expect(body.charts.estado.labels).toEqual(["Activos", "Inactivos"]);
    expect(body.charts.estado.series[0].data).toHaveLength(2);
    expect(body.charts.porRol.labels).toContain("admin");
    expect(body.charts.porRol.series[0].data).toHaveLength(
      body.charts.porRol.labels.length,
    );
    expect(body.charts.porMesa.labels).toContain("Sin mesa");
    expect(body.charts.porMesa.series[0].data).toHaveLength(
      body.charts.porMesa.labels.length,
    );
    expect(Array.isArray(body.filtros.mesas)).toBe(true);
    expect(body.filtros.roles).toContain("admin");
  });

  test("rechaza parámetros inválidos con 400", async ({ request }) => {
    const response = await request.get(
      "/api/admin/usuarios/estadisticas?activo=quizas",
      { headers: { cookie: `session_id=${cookie}` } },
    );
    expect(response.status()).toBe(400);
  });

  test("rechaza rol inválido con 400", async ({ request }) => {
    const response = await request.get(
      "/api/admin/usuarios/estadisticas?rol=nope",
      { headers: { cookie: `session_id=${cookie}` } },
    );
    expect(response.status()).toBe(400);
  });

  test("rechaza mesa no numérica con 400", async ({ request }) => {
    const response = await request.get(
      "/api/admin/usuarios/estadisticas?mesa=abc",
      { headers: { cookie: `session_id=${cookie}` } },
    );
    expect(response.status()).toBe(400);
  });
});
