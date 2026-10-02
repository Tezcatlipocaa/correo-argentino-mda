import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

// Rutas tocadas por la sección 1 de la auditoría UX/UI ("elementos rotos").
const ROUTES = [
  "/titulos",
  "/oficinas",
  "/inventario-terminales",
  "/contactos",
  "/supervision/cronograma",
  "/supervision/calidad-operadores",
  "/supervision/asignacion-autogestiones",
  "/generador-firmas",
  "/buscador-usuarios",
  "/recursos",
  "/recursos/aplicativos",
  "/admin/recursos",
  "/admin/aplicativos",
  "/admin/recursos/enlace/create",
];

// Clases eliminadas de DaisyUI v4: ya no existen en v5 y no deben reaparecer.
const DEAD_DAISYUI_V4_CLASSES = [
  "input-bordered",
  "select-bordered",
  "textarea-bordered",
  "form-control",
  "card-compact",
  "tabs-boxed",
];

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (admin) {
    await cleanupTestUser(admin.userId, admin.sessionId);
  }
});

test.describe("Regresión de elementos rotos", () => {
  for (const route of ROUTES) {
    test(`${route}: 200, un único h1 y sin clases DaisyUI v4 muertas`, async ({
      context,
      page,
    }) => {
      await setSessionCookie(context, admin.signedSessionId);

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("h1")).toHaveCount(1);

      for (const deadClass of DEAD_DAISYUI_V4_CLASSES) {
        await expect(
          page.locator(`[class~="${deadClass}"]`),
          `la clase muerta "${deadClass}" no debería existir en ${route}`,
        ).toHaveCount(0);
      }
    });
  }

  test("/supervision/cronograma renderiza el h1 visible 'Cronograma'", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/supervision/cronograma", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1")).toHaveText("Cronograma");
  });

  test("/recursos/aplicativos no dispara 404 de íconos (fallback SSR)", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    const notFound: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 404) notFound.push(response.url());
    });

    const response = await page.goto("/recursos/aplicativos", {
      waitUntil: "networkidle",
    });

    expect(response?.status()).toBe(200);
    expect(
      notFound.filter((url) => url.includes("/api/icons/")),
      `no debería haber 404 de íconos, pero hubo: ${notFound.join(", ")}`,
    ).toEqual([]);
  });

  test("/admin/recursos/enlace/create renderiza el formulario sin ReferenceError", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    const response = await page.goto("/admin/recursos/enlace/create", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Nuevo enlace");
    await expect(page.locator('input[name="title"]')).toHaveCount(1);
  });
});
