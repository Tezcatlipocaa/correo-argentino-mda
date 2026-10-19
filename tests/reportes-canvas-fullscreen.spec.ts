import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

let adminUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
});

test.describe("Explorador de Categorías - Soporte Pantalla Completa y Canvas", () => {
  test("muestra el contenedor del canvas y permite alternar pantalla completa", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/reportes/categorias#explorer");

    // Click tab if not active by hash
    const explorerTab = page.locator("#tab-explorer");
    await explorerTab.click();

    const canvasContainer = page.locator("#tree-canvas-container");
    await expect(canvasContainer).toBeVisible();

    const fullscreenBtn = page.locator("#btn-canvas-fullscreen");
    await expect(fullscreenBtn).toBeVisible();

    // Verify initial state: not fullscreen
    await expect(canvasContainer).not.toHaveClass(/canvas-fullscreen/);
    await expect(canvasContainer).not.toHaveClass(/is-fullscreen/);

    // Toggle fullscreen on with button
    await fullscreenBtn.click();
    await expect(canvasContainer).toHaveClass(/canvas-fullscreen/);
    await expect(canvasContainer).toHaveClass(/is-fullscreen/);

    // Toggle fullscreen off with button
    await fullscreenBtn.click();
    await expect(canvasContainer).not.toHaveClass(/canvas-fullscreen/);
    await expect(canvasContainer).not.toHaveClass(/is-fullscreen/);

    // Toggle fullscreen on again
    await fullscreenBtn.click();
    await expect(canvasContainer).toHaveClass(/canvas-fullscreen/);
    await expect(canvasContainer).toHaveClass(/is-fullscreen/);

    // Press Escape to exit fullscreen
    await page.keyboard.press("Escape");
    await expect(canvasContainer).not.toHaveClass(/canvas-fullscreen/);
    await expect(canvasContainer).not.toHaveClass(/is-fullscreen/);
  });
});
