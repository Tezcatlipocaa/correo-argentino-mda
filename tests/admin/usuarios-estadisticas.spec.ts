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

test.describe("Vista de estadísticas de usuarios (#183)", () => {
  const stamp = Date.now();
  const sessionId = `sess_stats_view_${stamp}`;
  const username = `admin_stats_view_${stamp}`;
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

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "session_id", value: cookie, domain: "localhost", path: "/" },
    ]);
  });

  test("renderiza KPIs, gráficos y no pide Chart.js por CDN", async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("cdn.jsdelivr.net")) {
        externalRequests.push(request.url());
      }
    });

    await page.goto("/admin/usuarios/estadisticas");
    await expect(
      page.getByRole("heading", { name: "Estadísticas de usuarios" }),
    ).toBeVisible();

    await expect(page.locator('[data-chart-card] canvas')).toHaveCount(3);
    await expect(page.locator('[data-chart-empty]').first()).toBeHidden();

    await expect(
      page.locator('[data-kpi="total"] [data-kpi-value]'),
    ).not.toHaveText("…");
    await expect(
      page.locator('[data-kpi="activos"] [data-kpi-value]'),
    ).not.toHaveText("…");

    const estadoCard = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Activos vs inactivos" }) });
    await estadoCard.locator("[data-table-toggle]").click();
    await expect(
      estadoCard.locator('td[data-label="Activos"]'),
    ).not.toHaveText("0");

    expect(externalRequests).toEqual([]);
  });

  test("el filtro por rol actualiza la URL y los datos del gráfico", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios/estadisticas");
    const porRolCard = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Usuarios por rol" }) });
    await porRolCard.locator("[data-table-toggle]").click();
    await expect(
      porRolCard.locator('td[data-label="admin"]'),
    ).toBeVisible();

    await page.selectOption("#stats-rol", "agent");
    await expect(page).toHaveURL(/rol=agent/);

    await expect(porRolCard.locator("td[data-label='agent']")).toBeVisible();
    await expect(porRolCard.locator("td[data-label='admin']")).toHaveCount(0);
  });

  test("el filtro por rol se inicializa desde la query de la URL", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios/estadisticas?rol=agent");
    await expect(page.locator("#stats-rol")).toHaveValue("agent");

    const porRolCard = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Usuarios por rol" }) });
    await porRolCard.locator("[data-table-toggle]").click();
    await expect(
      porRolCard.locator("td[data-label='agent']"),
    ).toBeVisible();
    await expect(
      porRolCard.locator("td[data-label='admin']"),
    ).toHaveCount(0);
  });

  test("el CTA vive en la fila de botones y lleva a las estadísticas", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios");
    const fila = page
      .locator("div.flex.flex-wrap.items-center.gap-3")
      .filter({ has: page.getByRole("button", { name: /tabla comparativa/ }) });
    await expect(fila.locator("[data-cta-estadisticas]")).toBeVisible();
    await page.locator("[data-cta-estadisticas]").click();
    await expect(page).toHaveURL(/\/admin\/usuarios\/estadisticas$/);
    await expect(
      page.getByRole("heading", { name: "Estadísticas de usuarios" }),
    ).toBeVisible();
  });

  test("el botón volver del header regresa a la gestión de usuarios", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios/estadisticas");
    await page
      .locator("header")
      .getByRole("link", { name: "Volver a Gestión de usuarios" })
      .click();
    await expect(page).toHaveURL(/\/admin\/usuarios$/);
  });
});
