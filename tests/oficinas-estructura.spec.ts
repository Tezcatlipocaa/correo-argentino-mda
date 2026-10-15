import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

test.describe("Estructura de Red Postal (/oficinas/estructura)", () => {
  let admin: TestUser;

  test.beforeAll(async () => {
    admin = await createTestUserAndSession("admin");
  });

  test.afterAll(async () => {
    if (admin) await cleanupTestUser(admin.userId, admin.sessionId);
  });

  test("renderiza el canvas interactivo, muestra las 5 regiones iniciales y abre el drawer al interactuar", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/oficinas/estructura");

    // Verificar encabezado y títulos
    await expect(page.locator("h1")).toContainText("Estructura de Red Postal");
    await expect(page.locator("a[aria-label='Volver al directorio']")).toBeVisible();

    // Canvas SVG presente
    const svg = page.locator("svg[data-tree-canvas]");
    await expect(svg).toBeVisible({ timeout: 15000 });

    // Verificar que las 5 regiones principales están visibles como nodos
    const regionIds = ["reg-CABA", "reg-SUR", "reg-PBA-LP", "reg-NEA", "reg-NOA"];
    for (const regId of regionIds) {
      await expect(page.locator(`[data-node-id='${regId}']`)).toBeVisible({ timeout: 15000 });
    }

    // Probar el switch de "Solo Cabeceras"
    const cabecerasToggle = page.locator("#toggle-cabeceras");
    await expect(cabecerasToggle).toBeVisible();
    await cabecerasToggle.check();
    await expect(cabecerasToggle).toBeChecked();

    // Probar Drawer inspector: hacer click en el nodo de CABA
    const cabaNode = page.locator("[data-node-id='reg-CABA']");
    await expect(cabaNode).toBeVisible();
    await cabaNode.click();

    const drawer = page.locator("aside[role='dialog']");
    await expect(drawer).toBeVisible();

    // Cerrar drawer con tecla Escape
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveClass(/translate-x-full/);
  });

  test("el botón de CTA en el directorio redirige correctamente a la estructura", async ({
    page,
    context,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/oficinas");

    const ctaButton = page.locator("[data-cta-estructura-oficinas]");
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    await page.waitForURL("**/oficinas/estructura");
    await expect(page.locator("h1")).toContainText("Estructura de Red Postal");
  });
});
