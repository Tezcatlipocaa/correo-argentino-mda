import { test, expect } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie } from "./helpers/auth";

let adminUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (adminUser) {
    await cleanupTestUser(adminUser.userId, adminUser.sessionId);
  }
});

test.describe("Renderizado Reactivo de Propuesta C en el Mapa (/reportes/categorias)", () => {
  test("cambia entre vista Actual y Propuesta C actualizando los nodos en el canvas", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias#explorer");

    const btnActual = page.locator("#btn-view-actual");
    const btnPropuesta = page.locator("#btn-view-propuesta");
    const canvasContainer = page.locator("#tree-canvas-container");

    await expect(canvasContainer).toBeVisible();
    await expect(btnActual).toHaveClass(/btn-active/);

    // Initial state: shows "Mesa de Ayuda TI" as root
    await expect(canvasContainer.getByText("Mesa de Ayuda TI")).toBeVisible();

    // Click on Propuesta C
    await btnPropuesta.click();
    await expect(btnPropuesta).toHaveClass(/btn-active/);
    await expect(btnActual).not.toHaveClass(/btn-active/);

    // Canvas must reactively re-render showing Propuesta C root
    await expect(canvasContainer.getByText("Propuesta C (Híbrida)")).toBeVisible();

    // Click back to Actual
    await btnActual.click();
    await expect(btnActual).toHaveClass(/btn-active/);
    await expect(btnPropuesta).not.toHaveClass(/btn-active/);

    // Canvas restores Actual tree
    await expect(canvasContainer.getByText("Mesa de Ayuda TI")).toBeVisible();
  });
});
