import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * RBAC de /automatizaciones:
 * - Lectura (listado y detalle): cualquier usuario con sesión iniciada.
 * - Escritura (cerrar/reabrir/editar datos): supervisor+.
 *
 * La decisión server-side de escritura vive en
 * `getModulePermissions("automatizaciones").canWrite` y está cubierta por
 * `tests/workflow-closures.test.mjs` y `roles-matrix-consistency.test.ts`.
 * Acá verificamos el acceso a la ruta y el gating de UI (que un usuario sin
 * permiso de escritura no reciba los controles de cierre/reapertura).
 */

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let supervisorUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
  supervisorUser = await createTestUserAndSession("supervisor");
});

test.afterAll(async () => {
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
  await cleanupTestUser(supervisorUser.userId, supervisorUser.sessionId);
});

test.describe("RBAC de /automatizaciones", () => {
  test("agent accede al listado sin redirect de autorización", async ({
    context,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    const response = await context.request.get("/automatizaciones", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
  });

  test("supervisor accede al listado", async ({ context }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);
    const response = await context.request.get("/automatizaciones", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
  });

  test("agent ve la sección en la sidebar", async ({ context, page }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones");
    await expect(
      page.locator('a[href="/automatizaciones"]').first(),
    ).toBeVisible();
  });

  test("agent no recibe controles de escritura en el detalle", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones");

    const detailLink = page.locator('a[href^="/automatizaciones/"]').first();
    const count = await detailLink.count();
    test.skip(
      count === 0,
      "Sin automatizaciones cargadas (InvGate): no hay detalle para verificar el gating.",
    );

    await detailLink.click();
    await page.waitForURL(/\/automatizaciones\/\d+/);

    await expect(page.locator("[data-open-close-automation]")).toHaveCount(0);
    await expect(page.locator("[data-reopen-automation]")).toHaveCount(0);
  });

  test("sin sesión, /automatizaciones redirige a login", async ({ request }) => {
    const response = await request.get("/automatizaciones", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toContain("/login");
  });
});
