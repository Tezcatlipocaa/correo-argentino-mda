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
      // /supervision/cronograma es una vista de aplicación a pantalla completa y
      // deliberadamente NO lleva h1 ni PageHeader (decisión de producto,
      // 2026-09-30). Para el resto de rutas se exige exactamente un h1.
      if (route !== "/supervision/cronograma") {
        await expect(page.locator("h1")).toHaveCount(1);
      }

      for (const deadClass of DEAD_DAISYUI_V4_CLASSES) {
        await expect(
          page.locator(`[class~="${deadClass}"]`),
          `la clase muerta "${deadClass}" no debería existir en ${route}`,
        ).toHaveCount(0);
      }
    });
  }

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

  test("/titulos: el panel de 'Ver más' se dibuja por encima del header", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    await page.goto("/titulos", { waitUntil: "load" });
    await page.waitForSelector('button:has-text("Ver más")', {
      timeout: 30000,
    });
    await page.locator('button:has-text("Ver más")').first().click();
    await page.waitForTimeout(900);

    const result = await page.evaluate(() => {
      const header = document.querySelector("header");
      const panel = document.querySelector("aside.fixed.inset-y-0");
      if (!header || !panel) return null;

      const r = panel.getBoundingClientRect();
      const inside = (el: Element | null, root: Element | null) =>
        !!el && !!root && (el === root || root.contains(el));

      // Punto DENTRO del panel, en la franja vertical que cubre el header.
      const inPanel = document.elementFromPoint(
        Math.round(r.left + r.width / 2),
        Math.round(Math.min(r.top + 60, window.innerHeight / 2)),
      );
      // Punto SOBRE el header, fuera del panel: debe quedar tapado por el overlay.
      const overHeader = document.elementFromPoint(
        Math.max(16, Math.round(r.left - 80)),
        40,
      );

      return {
        headerZ: Number(getComputedStyle(header).zIndex),
        panelZ: Number(getComputedStyle(panel).zIndex),
        panelCoversHeaderTop: r.top <= 1,
        panelIsTopmost: inside(inPanel, panel),
        headerCovered: !inside(overHeader, header),
      };
    });

    expect(result, "el panel de 'Ver más' debe existir").not.toBeNull();
    expect(result!.panelZ).toBeGreaterThan(result!.headerZ);
    expect(result!.panelCoversHeaderTop).toBe(true);
    expect(
      result!.panelIsTopmost,
      "el panel debe pintar por encima del header en su propio área",
    ).toBe(true);
    expect(
      result!.headerCovered,
      "el header debe quedar cubierto por el overlay al abrir el panel",
    ).toBe(true);
  });

  test("/titulos: el modal de edición se dibuja por encima del header", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    await page.goto("/titulos", { waitUntil: "load" });
    await page.waitForSelector('button:has-text("Ver más")', {
      timeout: 30000,
    });
    await page.locator('button:has-text("Ver más")').first().click();
    await page.waitForTimeout(900);
    await page.locator('[data-tip="Editar"] button').click();
    await page.waitForTimeout(700);

    const result = await page.evaluate(() => {
      const header = document.querySelector("header");
      const openWrapper = Array.from(
        document.querySelectorAll<HTMLElement>("div.fixed.inset-0"),
      ).find((d) => {
        const cs = getComputedStyle(d);
        if (cs.visibility === "hidden" || Number(cs.opacity) < 0.5) return false;
        return /Editar/.test(d.querySelector("h2")?.textContent ?? "");
      });
      if (!header || !openWrapper) return null;
      return {
        headerZ: Number(getComputedStyle(header).zIndex),
        modalZ: Number(getComputedStyle(openWrapper).zIndex),
        covered: !header.contains(document.elementFromPoint(16, 40)),
      };
    });

    expect(result, "el modal de edición debe estar abierto").not.toBeNull();
    expect(result!.modalZ).toBeGreaterThan(result!.headerZ);
    expect(
      result!.covered,
      "el header debe quedar cubierto por el overlay del modal",
    ).toBe(true);
  });
});
