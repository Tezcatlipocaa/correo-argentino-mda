import "dotenv/config";
import { test, expect } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie } from "../helpers/auth";

let supervisorUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  const helpdeskName = "TI_GSM_MDA TI";
  supervisorUser = await createTestUserAndSession("supervisor", { helpdeskName });
  agentUser = await createTestUserAndSession("agent", { helpdeskName });
});

test.afterAll(async () => {
  if (supervisorUser) await cleanupTestUser(supervisorUser.userId, supervisorUser.sessionId);
  if (agentUser) await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test("RBAC: el rol agent no puede acceder a /supervision/autogestiones-metricas", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, agentUser.signedSessionId);
  await page.goto("/supervision/autogestiones-metricas");
  // El middleware redirige al home (200) a un usuario autenticado sin permiso.
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("h1")).not.toContainText("Métricas de Autogestiones");
});

test("Acceso permitido para supervisor: visualización de KPIs, gráficos y controles", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, supervisorUser.signedSessionId);
  const response = await page.goto("/supervision/autogestiones-metricas");
  expect(response?.status()).toBe(200);

  // Encabezado
  await expect(page.locator("h1")).toContainText("Métricas de Autogestiones");

  // KPIs presentes
  await expect(page.locator("#kpi-total-asignadas")).toBeVisible();
  await expect(page.locator("#kpi-cola-pendiente")).toBeVisible();
  await expect(page.locator("#kpi-tasa-automatizacion")).toBeVisible();
  await expect(page.locator("#kpi-operadores-activos")).toBeVisible();

  // Filtros de presets y botones
  await expect(page.locator("#presets-filter-bar")).toBeVisible();
  await expect(page.locator("#btn-export-csv")).toBeVisible();
  await expect(page.locator("#btn-refresh-metrics")).toBeVisible();

  // Las 5 tarjetas de gráfico (ChartCard)
  await expect(page.locator('[data-chart-name="ag-modalidades"]')).toBeVisible();
  await expect(page.locator('[data-chart-name="ag-temporal"]')).toBeVisible();
  await expect(page.locator('[data-chart-name="ag-operadores"]')).toBeVisible();
  await expect(page.locator('[data-chart-name="ag-categorias"]')).toBeVisible();
  await expect(page.locator('[data-chart-name="ag-creadores"]')).toBeVisible();

  // Tabla de asignaciones
  await expect(page.locator("#table-assignments-body")).toBeVisible();
});

test("API: /api/autogestion/metricas responde JSON con estructura válida", async ({
  request,
}) => {
  const baseURL = test.info().project.use.baseURL ?? "http://127.0.0.1:4321";
  const res = await request.get(`${baseURL}/api/autogestion/metricas?preset=hoy`, {
    headers: {
      Cookie: `session_id=${supervisorUser.signedSessionId}`,
    },
  });

  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.kpis).toBeDefined();
  expect(json.temporal).toBeDefined();
  expect(json.byOperator).toBeDefined();
  expect(json.byType).toBeDefined();
});

test("API: /api/autogestion/metricas/export.csv descarga archivo CSV con cabeceras", async ({
  request,
}) => {
  const baseURL = test.info().project.use.baseURL ?? "http://127.0.0.1:4321";
  const res = await request.get(`${baseURL}/api/autogestion/metricas/export.csv?preset=ultimos_7_dias`, {
    headers: {
      Cookie: `session_id=${supervisorUser.signedSessionId}`,
    },
  });

  expect(res.status()).toBe(200);
  const contentType = res.headers()["content-type"];
  expect(contentType).toContain("text/csv");
  const text = await res.text();
  expect(text).toContain("ID,Ticket,Operador,Asignado Por,Tipo,Fecha Hora");
});
