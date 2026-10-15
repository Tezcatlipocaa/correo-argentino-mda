import "dotenv/config";
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

test.describe("Explorador del Árbol Interactivo (/reportes/categorias)", () => {
  test("muestra contenedor del explorador, buscador, controles y botones de vista", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias#explorer");
    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("#panel-explorer")).toBeVisible();

    await expect(page.locator("#tree-explorer-container")).toBeVisible();
    await expect(page.locator("#tree-search-input")).toBeVisible();
    await expect(page.locator("#btn-expand-all")).toBeVisible();
    await expect(page.locator("#btn-collapse-all")).toBeVisible();
    await expect(page.locator("#btn-toggle-fullscreen")).toBeVisible();
    await expect(page.locator("#vC")).toBeVisible();
    await expect(page.locator("#vCur")).toBeVisible();
    await expect(page.locator("#vA")).toBeVisible();
    await expect(page.locator("#vB")).toBeVisible();
    await expect(page.locator("#vCmp")).toBeVisible();
  });

  test("permite alternar vistas de árbol", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias#explorer");
    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("#panel-explorer")).toBeVisible();

    const btnC = page.locator("#vC");
    const btnCur = page.locator("#vCur");
    const btnA = page.locator("#vA");
    const btnB = page.locator("#vB");
    const btnCmp = page.locator("#vCmp");

    await expect(btnC).toBeVisible();
    await btnCur.click();
    await expect(btnCur).toHaveClass(/on|active|btn-active/);

    await btnA.click();
    await expect(btnA).toHaveClass(/on|active|btn-active/);

    await btnB.click();
    await expect(btnB).toHaveClass(/on|active|btn-active/);

    await btnCmp.click();
    await expect(btnCmp).toHaveClass(/on|active|btn-active/);
    await expect(page.locator("#cmp")).toBeVisible();
    await expect(page.locator("#tree")).toBeHidden();

    await btnC.click();
    await expect(btnC).toHaveClass(/on|active|btn-active/);
    await expect(page.locator("#tree")).toBeVisible();
    await expect(page.locator("#cmp")).toBeHidden();
  });

  test("permite expandir y colapsar nodos", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias#explorer");
    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("#panel-explorer")).toBeVisible();

    const expandBtn = page.locator("#btn-expand-all");
    const collapseBtn = page.locator("#btn-collapse-all");

    await expandBtn.click();
    await expect(page.locator("#tree-explorer-container li[aria-expanded='true']").first()).toBeVisible();

    await collapseBtn.click();
    await expect(page.locator("#tree-explorer-container li[aria-expanded='true']")).toHaveCount(0);
  });

  test("permite buscar y resaltar categorías coincidentes (ej: Mosaic)", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias#explorer");
    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("#panel-explorer")).toBeVisible();

    const searchInput = page.locator("#tree-search-input");
    await searchInput.fill("Mosaic");

    await expect(page.locator("#tree-explorer-container .hit, #tree-explorer-container li.hit").first()).toBeVisible();

    const clearBtn = page.locator("#btn-tree-search-clear");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(searchInput).toHaveValue("");
    await expect(page.locator("#tree-explorer-container li.hit")).toHaveCount(0);
  });

  test("permite alternar modo pantalla completa y salir con Escape", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId, "localhost");
    await setSessionCookie(context, adminUser.signedSessionId, "127.0.0.1");
    await page.goto("/reportes/categorias#explorer");
    await page.locator('button[data-tab="explorer"]').click();
    await expect(page.locator("#panel-explorer")).toBeVisible();

    const container = page.locator("#tree-explorer-container");
    const fullscreenBtn = page.locator("#btn-toggle-fullscreen");

    await expect(container).not.toHaveClass(/fullscreen-active/);
    await fullscreenBtn.click();
    await expect(container).toHaveClass(/fullscreen-active/);

    await page.keyboard.press("Escape");
    await expect(container).not.toHaveClass(/fullscreen-active/);
  });
});
