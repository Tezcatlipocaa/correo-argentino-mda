import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (admin) {
    await cleanupTestUser(admin.userId, admin.sessionId);
  }
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, admin.signedSessionId);
});

test.describe("Páginas de error", () => {
  test("navegación a ruta inexistente muestra página 404 con código 404 y botón de retorno", async ({
    page,
  }) => {
    const response = await page.goto("/ruta-inexistente-para-test-404");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Página no encontrada")).toBeVisible();
    const backButton = page.getByRole("link", { name: "Volver al inicio" });
    await expect(backButton).toBeVisible();
    const href = await backButton.getAttribute("href");
    expect(href).toBeDefined();
    expect(href).toMatch(/^\/($|[?#])/);
  });

  test("navegación a /500 muestra página 500 con botones de reintento e inicio", async ({
    page,
  }) => {
    await page.goto("/500");
    await expect(page.getByText("Error interno del servidor")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    const backButton = page.getByRole("link", { name: "Volver al inicio" });
    await expect(backButton).toBeVisible();
    const href = await backButton.getAttribute("href");
    expect(href).toBeDefined();
    expect(href).toMatch(/^\/($|[?#])/);
  });
});
