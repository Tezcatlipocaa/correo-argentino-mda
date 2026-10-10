import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";
import { eq, isNotNull, ne } from "drizzle-orm";
import { db } from "../../src/db/index";
import { provinces, regions, sessions, users } from "../../src/db/schema";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";
function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

async function findEmptyRegionProvinceCombo(): Promise<{
  regionId: string;
  provinceCode: string;
}> {
  // Provincia de una región + otra región distinta ⇒ intersección vacía.
  const [prov] = await db
    .select({ code: provinces.code, regionId: provinces.regionId })
    .from(provinces)
    .where(isNotNull(provinces.regionId))
    .limit(1);
  const [other] = await db
    .select({ id: regions.id })
    .from(regions)
    .where(ne(regions.id, prov.regionId as string))
    .limit(1);
  return { regionId: other.id, provinceCode: prov.code };
}

test.describe("Endpoint de estadísticas de terminales", () => {
  const stamp = Date.now();
  const sessionId = `sess_term_stats_${stamp}`;
  const username = `term_stats_${stamp}`;
  let userId = 0;
  let cookie = "";

  test.beforeAll(async () => {
    const [row] = await db
      .insert(users)
      .values({ username, password: "x", role: "admin" })
      .returning({ id: users.id });
    userId = row.id;
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: Date.now() + 86_400_000,
    });
    cookie = sign(sessionId);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  const authHeaders = () => ({ cookie: `session_id=${cookie}` });

  test("sin sesión responde 401", async ({ request }) => {
    const response = await request.get("/api/terminals/estadisticas");
    expect(response.status()).toBe(401);
  });

  test("con sesión devuelve KPIs y los cinco charts", async ({ request }) => {
    const response = await request.get("/api/terminals/estadisticas", {
      headers: authHeaders(),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.kpis).toMatchObject({
      total: expect.any(Number),
      sucursales: expect.any(Number),
      pctWin11: expect.any(Number),
      pctWin10: expect.any(Number),
    });
    expect(body.kpis.total).toBeGreaterThan(0);
    expect(Object.keys(body.charts).sort()).toEqual([
      "porMarca",
      "porProvincia",
      "porRegion",
      "porSo",
      "topSucursales",
    ]);
    for (const chart of Object.values(body.charts) as {
      labels: string[];
      series: { label: string; data: number[] }[];
    }[]) {
      expect(chart.series[0].data).toHaveLength(chart.labels.length);
    }
    expect(body.filtros).toEqual({
      region: null,
      provincia: null,
      marca: null,
      os: null,
    });
  });

  test("el filtro por marca reduce el total", async ({ request }) => {
    const all = await (
      await request.get("/api/terminals/estadisticas", {
        headers: authHeaders(),
      })
    ).json();
    const dell = await (
      await request.get("/api/terminals/estadisticas?marca=dell", {
        headers: authHeaders(),
      })
    ).json();
    expect(dell.kpis.total).toBeGreaterThan(0);
    expect(dell.kpis.total).toBeLessThan(all.kpis.total);
  });

  test("rechaza filtros inválidos con 400", async ({ request }) => {
    for (const query of ["region=NOPE", "marca=sony", "os=amiga"]) {
      const response = await request.get(
        `/api/terminals/estadisticas?${query}`,
        { headers: authHeaders() },
      );
      expect(response.status(), query).toBe(400);
    }
  });

  test("región y provincia de distinta región dan total cero", async ({
    request,
  }) => {
    const empty = await findEmptyRegionProvinceCombo();
    const response = await request.get(
      `/api/terminals/estadisticas?region=${empty.regionId}&provincia=${empty.provinceCode}`,
      { headers: authHeaders() },
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).kpis.total).toBe(0);
  });
});

test.describe("Vista de estadísticas de terminales", () => {
  const stamp = Date.now();
  const sessionId = `sess_term_stats_view_${stamp}`;
  const username = `term_stats_view_${stamp}`;
  let userId = 0;
  let cookie = "";

  test.beforeAll(async () => {
    const [row] = await db
      .insert(users)
      .values({ username, password: "x", role: "agent" })
      .returning({ id: users.id });
    userId = row.id;
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: Date.now() + 86_400_000,
    });
    cookie = sign(sessionId);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "session_id", value: cookie, domain: "localhost", path: "/" },
    ]);
  });

  test("renderiza KPIs, cinco gráficos y no pide Chart.js por CDN", async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("cdn.jsdelivr.net")) {
        externalRequests.push(request.url());
      }
    });

    await page.goto("/inventario-terminales/estadisticas");
    await expect(
      page.getByRole("heading", { name: "Estadísticas de terminales" }),
    ).toBeVisible();

    await expect(page.locator("[data-chart-card] canvas")).toHaveCount(5);
    await expect(page.locator("[data-chart-empty]:visible")).toHaveCount(0);

    const total = page.locator('[data-kpi="total"] [data-kpi-value]');
    await expect(total).not.toHaveText("…");
    expect(await total.textContent()).toMatch(/^\d{1,3}(\.\d{3})*$/);

    expect(externalRequests).toEqual([]);
  });

  test("hace un solo fetch por gráfico vivo (no duplica por hidratación)", async ({
    page,
  }) => {
    const endpointRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/terminals/estadisticas")) {
        endpointRequests.push(request.url());
      }
    });

    await page.goto("/inventario-terminales/estadisticas");
    await expect(page.locator("[data-chart-card] canvas")).toHaveCount(5);
    await expect(page.locator("[data-chart-empty]:visible")).toHaveCount(0);
    await expect(
      page.locator('[data-kpi="total"] [data-kpi-value]'),
    ).not.toHaveText("…");

    // Dejar asentar cualquier fetch tardío antes de contar.
    await page.waitForTimeout(1000);

    // 1 fetch de KPIs (content) + 1 por cada uno de los 5 ChartCard vivos.
    // Si la deduplicación se rompe, cada gráfico dispara init + stats:filters-changed
    // con la misma query y el total sube a 11 (y voltea el rate limit apiRead de 60/min).
    expect(endpointRequests).toHaveLength(6);
  });

  test("el toggle Ver tabla muestra los datos y oculta el canvas", async ({
    page,
  }) => {
    await page.goto("/inventario-terminales/estadisticas");
    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por provincia" }) });
    await card.locator("[data-table-toggle]").click();
    await expect(card.locator("canvas")).toBeHidden();
    await expect(card.locator("[data-chart-table] td").first()).toBeVisible();
  });

  test("el filtro por marca sincroniza la URL y recalcula los datos", async ({
    page,
  }) => {
    await page.goto("/inventario-terminales/estadisticas");
    const total = page.locator('[data-kpi="total"] [data-kpi-value]');
    await expect(total).not.toHaveText("…");
    const before = await total.textContent();

    await page.selectOption("#stats-marca", "dell");
    await expect(page).toHaveURL(/marca=dell/);

    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por marca" }) });
    await card.locator("[data-table-toggle]").click();
    await expect(
      card.locator('[data-chart-table] td[data-label="Dell"]'),
    ).toBeVisible();
    await expect(card.locator("[data-chart-table] tbody tr")).toHaveCount(1);

    await expect(total).not.toHaveText(before as string);
  });

  test("inicializa los filtros desde la query de la URL", async ({ page }) => {
    await page.goto("/inventario-terminales/estadisticas?marca=dell");
    await expect(page.locator("#stats-marca")).toHaveValue("dell");
    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por marca" }) });
    await card.locator("[data-table-toggle]").click();
    await expect(card.locator("[data-chart-table] tbody tr")).toHaveCount(1);
    await expect(
      card.locator('[data-chart-table] td[data-label="Dell"]'),
    ).toBeVisible();
  });

  test("estado vacío: KPIs en cero, gráficos vacíos y export oculto", async ({
    page,
  }) => {
    const empty = await findEmptyRegionProvinceCombo();
    await page.goto(
      `/inventario-terminales/estadisticas?region=${empty.regionId}&provincia=${empty.provinceCode}`,
    );

    await expect(page.locator('[data-kpi="total"] [data-kpi-value]')).toHaveText(
      "0",
    );
    await expect(page.locator("[data-chart-empty]:visible")).toHaveCount(5);
    await expect(page.locator("[data-chart-card] canvas:visible")).toHaveCount(
      0,
    );
    await expect(page.locator("[data-export-buttons]:visible")).toHaveCount(0);
  });

  test("exporta CSV y PNG desde el gráfico", async ({ page }) => {
    await page.goto("/inventario-terminales/estadisticas");
    const card = page
      .locator("[data-chart-card]")
      .filter({ has: page.getByRole("heading", { name: "Equipos por región" }) });
    await expect(card.locator("[data-export-buttons]")).toBeVisible();

    const [csv] = await Promise.all([
      page.waitForEvent("download"),
      card.locator("[data-export-csv]").click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(/^equipos-por-region-\d{8}\.csv$/);
    const csvPath = await csv.path();
    if (csvPath) {
      const { readFileSync } = await import("fs");
      const contents = readFileSync(csvPath, "utf8");
      expect(contents.startsWith("\uFEFF")).toBe(true);
      expect(contents).toContain('"Equipos"');
      expect(contents.split("\r\n")[0]).toContain(";");
    }

    const [png] = await Promise.all([
      page.waitForEvent("download"),
      card.locator("[data-export-png]").click(),
    ]);
    expect(png.suggestedFilename()).toMatch(/^equipos-por-region-\d{8}\.png$/);
  });

  test("el botón volver del header regresa al inventario", async ({ page }) => {
    await page.goto("/inventario-terminales/estadisticas");
    await page
      .locator("header")
      .getByRole("link", { name: "Volver al inventario" })
      .click();
    await expect(page).toHaveURL(/\/inventario-terminales$/);
  });
});
