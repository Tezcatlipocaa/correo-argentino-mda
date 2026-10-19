import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

test.describe("Control de Asistencia - Render y Carga de Operadores", () => {
  let supervisorUser: TestUser;

  test.beforeAll(async () => {
    supervisorUser = await createTestUserAndSession("supervisor", {
      helpdeskName: "TI_GSM_MDA TI",
    });
  });

  test.afterAll(async () => {
    if (supervisorUser) {
      await cleanupTestUser(supervisorUser.userId, supervisorUser.sessionId);
    }
  });

  test("el listado de asistencia no queda en loading y renderiza la tabla de operadores con el script cliente", async ({
    page,
  }) => {
    await setSessionCookie(page.context(), supervisorUser.signedSessionId);

    await page.goto("/supervision/asistencia");

    // Verificar que la ruta no rebote a login ni a error
    expect(new URL(page.url()).pathname).toBe("/supervision/asistencia");

    // Esperar a que la tabla cargue y desaparezca el spinner inicial
    const loadingText = page.locator("#attendance-table-body >> text=Cargando registros...");
    await expect(loadingText).not.toBeVisible({ timeout: 15_000 });

    // La barra de estado de sincronización debe estar presente en el DOM
    const syncStatusBar = page.locator("#sync-status-bar");
    await expect(syncStatusBar).toBeAttached();

    // Debe haber al menos una fila principal de asistencia renderizada
    const operatorRows = page.locator(".main-attendance-row");
    await expect(operatorRows.first()).toBeVisible({ timeout: 10_000 });
  });
});
