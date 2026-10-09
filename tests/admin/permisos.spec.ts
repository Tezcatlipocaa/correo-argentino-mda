import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import { users, sessions } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

const SECRET_KEY = process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";
function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

/**
 * Base efectiva del proyecto. `test.info()` solo funciona dentro de callbacks
 * de test: HOST y NEW_URL se declaraban a nivel de modulo, asi que se convierten
 * en funciones (el puerto puede variar via `PLAYWRIGHT_BASE_URL`).
 */
function host(): string {
  return test.info().project.use.baseURL ?? "http://localhost:4321";
}

function newUrl(): string {
  return `${host()}/admin/usuarios/mesas-de-ayuda`;
}
const COORD = "TI_GSM_Mesa de Coord";
const MDA_TI = "TI_GSM_MDA TI";

test.describe("Admin Mesas de ayuda", () => {
  let adminCookie: string;
  let agentCookie: string;
  let adminUsername: string;
  let agentUsername: string;
  let adminSession: string;
  let agentSession: string;
  let adminId: number;
  let agentId: number;

  test.beforeAll(async () => {
    const ts = Date.now();
    adminUsername = `admin_mesas_${ts}`;
    agentUsername = `agent_mesas_${ts}`;
    adminSession = `mesas-admin-${ts}`;
    agentSession = `mesas-agent-${ts}`;

    const [au] = await db
      .insert(users)
      .values({ username: adminUsername, password: "x", role: "admin" })
      .returning({ id: users.id });
    const [gu] = await db
      .insert(users)
      .values({ username: agentUsername, password: "x", role: "agent" })
      .returning({ id: users.id });
    adminId = au.id;
    agentId = gu.id;

    await db.insert(sessions).values({ id: adminSession, userId: adminId, expiresAt: Date.now() + 86400000 });
    await db.insert(sessions).values({ id: agentSession, userId: agentId, expiresAt: Date.now() + 86400000 });
    adminCookie = sign(adminSession);
    agentCookie = sign(agentSession);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.id, adminSession));
    await db.delete(sessions).where(eq(sessions.id, agentSession));
    await db.delete(users).where(eq(users.id, adminId));
    await db.delete(users).where(eq(users.id, agentId));
  });

  function withAdmin(context: any) {
    return context.addCookies([
      { name: "session_id", value: adminCookie, domain: "localhost", path: "/" },
    ]);
  }

  test("admin accede a la nueva ruta y ve la tabla de mesas", async ({ page, context }) => {
    await withAdmin(context);
    await page.goto(newUrl());
    await expect(page).not.toHaveURL(`${host()}/`);
    await expect(page.locator("#global-toast-container")).not.toContainText("Acceso no autorizado");
    await expect(page.locator("#permisos-root")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#mesas-table")).toBeVisible();
  });

  test("admin con canWrite ve el botón de sincronización", async ({ page, context }) => {
    await withAdmin(context);
    await page.goto(newUrl());
    await expect(page.locator("#mesas-sync")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#permisos-root[data-can-write='1']")).toBeVisible();
  });

  test("la tabla no expone columnas 'Última sincronización' ni 'Activa'", async ({ page, context }) => {
    await withAdmin(context);
    await page.goto(newUrl());
    await expect(page.locator("#mesas-table")).toBeVisible({ timeout: 15000 });

    const headers = (
      await page.locator("#mesas-table [data-table-header] > div").allTextContents()
    ).map(
      (t) => t.trim(),
    );
    expect(headers).toEqual(["Nombre", "InvGate ID", "Usuarios", "Asignable"]);
    expect(headers).not.toContain("Última sincronización");
    expect(headers).not.toContain("Activa");
  });

  test("toggle de asignable: MDA TI deshabilitado y mesas normales habilitadas", async ({
    page,
    context,
  }) => {
    await withAdmin(context);
    await page.goto(newUrl());
    await expect(page.locator("#mesas-table")).toBeVisible({ timeout: 15000 });

    await expect(page.locator("input[data-assignable-toggle]").first()).toBeVisible();
    await expect(
      page.locator(`input[data-assignable-toggle][data-mesa-name="${MDA_TI}"]`),
    ).toBeDisabled();
  });

  test("toggle OFF oculta la mesa del select de usuarios y ON la vuelve a mostrar", async ({
    page,
    context,
  }) => {
    await withAdmin(context);
    const api = context.request;
    await page.goto(newUrl());
    await expect(page.locator("#mesas-table")).toBeVisible({ timeout: 15000 });

    const root = page.locator("#permisos-root");
    const csrf = await root.getAttribute("data-csrf-token");
    expect(csrf).toBeTruthy();

    const coordToggle = page.locator(
      `input[data-assignable-toggle][data-mesa-name="${COORD}"]`,
    );
    await expect(coordToggle).toBeVisible();
    const coordInvgateId = Number(await coordToggle.getAttribute("data-invgate-id"));
    expect(coordInvgateId).toBeGreaterThan(0);

    const setAssignable = async (assignable: boolean) => {
      const res = await api.post(`${host()}/api/admin/permisos/mesas/assignable`, {
        data: { invgateId: coordInvgateId, assignable, csrf_token: csrf },
      });
      expect(res.ok()).toBeTruthy();
    };

    try {
      await setAssignable(false);
      await page.goto(`${host()}/admin/usuarios`);
      await page.locator("#btn-nuevo-usuario").click();
      await expect(page.locator("#modal-create-user")).toBeVisible();
      await expect(
        page.locator(`#admin-helpdesk option`, { hasText: COORD }),
      ).toHaveCount(0);

      await page.goto(newUrl());
      await expect(page.locator("#mesas-table")).toBeVisible({ timeout: 15000 });
      const csrf2 = await page.locator("#permisos-root").getAttribute("data-csrf-token");
      const res = await api.post(`${host()}/api/admin/permisos/mesas/assignable`, {
        data: { invgateId: coordInvgateId, assignable: true, csrf_token: csrf2 },
      });
      expect(res.ok()).toBeTruthy();

      await page.goto(`${host()}/admin/usuarios`);
      await page.locator("#btn-nuevo-usuario").click();
      await expect(page.locator("#modal-create-user")).toBeVisible();
      await expect(
        page.locator(`#admin-helpdesk option`, { hasText: COORD }),
      ).toHaveCount(1);
    } finally {
      // Restaurar el estado curado esperado, pase lo que pase.
      const csrf3 = await page.goto(newUrl()).then(() =>
        page.locator("#permisos-root").getAttribute("data-csrf-token"),
      );
      await api.post(`${host()}/api/admin/permisos/mesas/assignable`, {
        data: { invgateId: coordInvgateId, assignable: true, csrf_token: csrf3 },
      });
    }
  });

  test("la ruta vieja /admin/permisos redirige 302 a la nueva", async ({ context }) => {
    await withAdmin(context);
    const res = await context.request.get(`${host()}/admin/permisos`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["location"] ?? "").toContain("/admin/usuarios/mesas-de-ayuda");
  });

  test("agente es redirigido desde la nueva ruta", async ({ page, context }) => {
    await context.addCookies([
      { name: "session_id", value: agentCookie, domain: "localhost", path: "/" },
    ]);
    await page.goto(newUrl());
    await expect(page).toHaveURL(`${host()}/`);
    await expect(page.locator("#global-toast-container")).toContainText("Acceso no autorizado");
  });
});
