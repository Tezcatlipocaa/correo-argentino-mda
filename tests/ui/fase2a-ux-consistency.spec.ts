import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

// --- helpers -------------------------------------------------------------

/**
 * Niveles de los encabezados VISIBLES.
 * El filtro de `visibility` es imprescindible: los modales DaisyUI cerrados
 * tienen `visibility: hidden` pero conservan rects, y contaminan la secuencia.
 */
const visibleHeadingLevels = () =>
  Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .filter(
      (h) =>
        h.getClientRects().length > 0 &&
        getComputedStyle(h).visibility !== "hidden",
    )
    .map((h) => Number(h.tagName[1]));

// --- setup ---------------------------------------------------------------

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (admin) {
    await cleanupTestUser(admin.userId, admin.sessionId);
  }
});

// --- 2A.2 ids de SVG duplicados -----------------------------------------

const IDS_ROUTES = [
  "/oficinas",
  "/admin/usuarios",
  "/buscador-usuarios",
  "/contactos",
  "/recursos",
  "/recursos/aplicativos",
  "/supervision/calidad-operadores",
  "/supervision/asignacion-autogestiones",
  "/mesas-de-ayuda",
  "/inventario-terminales",
];

test.describe("Fase 2A — ids de SVG duplicados", () => {
  for (const route of IDS_ROUTES) {
    test(`sin ids duplicados: ${route}`, async ({ context, page }) => {
      await setSessionCookie(context, admin.signedSessionId);
      await page.goto(route, { waitUntil: "load" });
      await page.waitForTimeout(1500);

      const dups = await page.evaluate(() => {
        const counts: Record<string, number> = {};
        document.querySelectorAll("[id]").forEach((el) => {
          counts[el.id] = (counts[el.id] ?? 0) + 1;
        });
        return Object.entries(counts)
          .filter(([, c]) => c > 1)
          .map(([id, c]) => `${id} x${c}`);
      });

      expect(dups).toEqual([]);
    });
  }
});

// --- 2A.3 jerarquía de encabezados --------------------------------------

// /supervision/cronograma queda fuera por decisión de producto: es una vista de
// aplicación a pantalla completa y deliberadamente no lleva h1 ni PageHeader.
const HEADING_ROUTES = [
  "/oficinas",
  "/admin/usuarios",
  "/buscador-usuarios",
  "/contactos",
  "/recursos",
  "/recursos/aplicativos",
  "/supervision/calidad-operadores",
  "/supervision/asignacion-autogestiones",
  "/mesas-de-ayuda",
  "/inventario-terminales",
  "/generador-firmas",
  "/admin/aplicativos",
  "/admin/recursos",
];

test.describe("Fase 2A — jerarquía de encabezados", () => {
  for (const route of HEADING_ROUTES) {
    test(`sin saltos de jerarquía: ${route}`, async ({ context, page }) => {
      await setSessionCookie(context, admin.signedSessionId);
      await page.goto(route, { waitUntil: "load" });
      await page.waitForTimeout(1500);

      const levels = await page.evaluate(visibleHeadingLevels);
      expect(levels.length, "debe haber encabezados visibles").toBeGreaterThan(
        0,
      );
      expect(levels[0], "el primer encabezado visible debe ser h1").toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(
          levels[i] - levels[i - 1],
          `salto de h${levels[i - 1]} a h${levels[i]} (posicion ${i})`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test("el modal Acerca del proyecto no salta de h2 a h4", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/oficinas", { waitUntil: "load" });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const dialog = document.getElementById(
        "about-project-dialog",
      ) as HTMLDialogElement | null;
      dialog?.showModal();
    });

    const levels = await page.evaluate(() => {
      const dialog = document.getElementById("about-project-dialog");
      if (!dialog) return [] as number[];
      return Array.from(dialog.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) =>
        Number(h.tagName[1]),
      );
    });

    expect(levels.length).toBeGreaterThan(0);
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });
});

// --- 2A.4 inputs de credenciales sin nombre ------------------------------

test.describe("Fase 2A — credenciales accesibles", () => {
  for (const route of ["/recursos", "/recursos/aplicativos"]) {
    test(`inputs de credenciales con nombre accesible: ${route}`, async ({
      context,
      page,
    }) => {
      await setSessionCookie(context, admin.signedSessionId);
      await page.goto(route, { waitUntil: "load" });
      await page.waitForTimeout(1500);

      await page.evaluate(() => {
        document
          .querySelectorAll("details")
          .forEach((d) => ((d as HTMLDetailsElement).open = true));
      });

      const unnamed = await page.evaluate(() =>
        Array.from(document.querySelectorAll("input[data-password-input]"))
          .filter((el) => {
            const label = (el.getAttribute("aria-label") ?? "").trim();
            const labelledby = (
              el.getAttribute("aria-labelledby") ?? ""
            ).trim();
            const labels =
              el instanceof HTMLInputElement && el.labels
                ? Array.from(el.labels)
                    .map((l) => l.textContent ?? "")
                    .join(" ")
                    .trim()
                : "";
            return (
              label.length === 0 &&
              labelledby.length === 0 &&
              labels.length === 0
            );
          })
          .map((el) => (el.className || "input").slice(0, 80)),
      );

      expect(unnamed).toEqual([]);
    });
  }
});

// --- 2A.5 elevación: celdas del cronograma sin sombra --------------------

test.describe("Fase 2A — elevación", () => {
  test("las celdas del cronograma no llevan sombra", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/supervision/cronograma", { waitUntil: "load" });
    await page.waitForSelector(".monthly-cell-button", { timeout: 30000 });

    // Contrato: las celdas del mes son planas, sin utilidades de sombra.
    // (Se mide sobre el DOM renderizado, no sobre la fuente.)
    const withShadowClass = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".monthly-cell-button"))
        .map((c) => c.className)
        .filter((cls) =>
          /\bshadow-(?:sm|md|lg|xl|2xl|raised|overlay|modal|table-edge)\b/.test(
            cls,
          ),
        ),
    );

    expect(withShadowClass).toEqual([]);
  });
});

// --- Dashboard: módulos adicionales en variante compacta -----------------

test.describe("Dashboard — módulos adicionales", () => {
  test("los módulos adicionales usan la variante compacta y los 8 atajos por defecto no", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1500);

    const cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[aria-label^="Abrir "]')).map(
        (el) => ({
          href: el.getAttribute("href") ?? "",
          label: el.getAttribute("aria-label") ?? "",
          layout: el.getAttribute("data-layout") ?? "",
          x: Math.round(el.getBoundingClientRect().x),
        }),
      ),
    );

    const additional = cards.filter((c) => c.href.includes("/supervision"));
    const defaults = cards.filter((c) => !c.href.includes("/supervision"));

    const uniqueX = (list: { x: number }[]) =>
      [...new Set(list.map((c) => c.x))].sort((a, b) => a - b);

    expect(
      additional.length,
      "el admin debe ver módulos adicionales",
    ).toBeGreaterThan(0);
    expect(defaults.length, "deben ser 8 los atajos por defecto").toBe(8);
    expect(
      additional.filter((c) => c.layout !== "compact").map((c) => c.label),
      "módulos adicionales que NO usan la variante compacta",
    ).toEqual([]);
    expect(
      defaults.filter((c) => c.layout === "compact").map((c) => c.label),
      "atajos por defecto que NO deben ser compactos",
    ).toEqual([]);
    expect(
      uniqueX(additional),
      "los módulos adicionales deben alinearse en las mismas columnas que los 8 atajos",
    ).toEqual(uniqueX(defaults));
  });
});
