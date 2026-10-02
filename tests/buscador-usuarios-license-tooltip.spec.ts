import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

// Grupos que `getLicensesForGroup` reconoce (tokens E3/E1/F3/F1/Kiosko), más
// relleno sin licencia para tener varias filas en la grilla.
const GROUPS = [
  "Acceso E3 Comercial",
  "Acceso E1 Administrativo",
  "Licencia F3 Operaciones",
  "Licencia F1 Mostrador",
  "Kiosko Sucursal Norte",
  "Grupo Sin Licencia A",
  "Acceso VPN Corporativa",
  "Distribucion Correo Interno",
  "Soporte Tecnico Nivel 2",
  "Kiosko Sucursal Sur",
  "Acceso Carpeta Compartida",
  "Migracion Office Todos",
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

async function openTerminalWithGroups(page: Page): Promise<void> {
  // El AD no resuelve en el entorno de test: se sirve una respuesta con la
  // misma forma que el endpoint real para ejercitar el render de grupos.
  await page.route("**/api/usuarios/net-user*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        output: "salida de prueba",
        employee_number: "1234",
        fullname: "Prueba Usuario",
        groups: GROUPS,
      }),
    }),
  );

  // La búsqueda dispara con Enter (submit), no con el `input`.
  await page.goto("/buscador-usuarios", { waitUntil: "domcontentloaded" });
  await page.fill("#search-input", "a");
  await page.press("#search-input", "Enter");
  await page.waitForSelector("#results-grid > *");
  await page.locator("[data-net-user-btn]").first().click();
  await page.waitForSelector("#terminal-modal[open]");
  await page.waitForTimeout(1200);
}

/**
 * Muestra el tooltip con un `mouseover` sintético: `hover()` de Playwright hace
 * scroll-into-view y el listado oculta el tooltip al scrollear, así que en
 * viewports bajos daría un falso negativo.
 */
const showTooltip = (page: Page, index: number) =>
  page.evaluate((k) => {
    const btn = document.querySelectorAll<HTMLElement>(
      "#terminal-groups-list .license-info-btn",
    )[k];
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return true;
  }, index);

const readTooltip = (page: Page) =>
  page.evaluate(() => {
    const tip = document.getElementById("license-tooltip");
    const dialog = document.getElementById("terminal-modal");
    if (!tip || !dialog) return null;
    const cs = getComputedStyle(tip);
    const r = tip.getBoundingClientRect();

    // El hit-test necesita pointer-events porque el tooltip es
    // `pointer-events: none`; se restaura enseguida.
    const previous = tip.style.pointerEvents;
    tip.style.pointerEvents = "auto";
    const corners = [
      [r.left + 4, r.top + 4],
      [r.right - 4, r.top + 4],
      [r.left + 4, r.bottom - 4],
      [r.right - 4, r.bottom - 4],
    ].map(([x, y]) => {
      const hit = document.elementFromPoint(Math.round(x), Math.round(y));
      return !!hit && tip.contains(hit);
    });
    tip.style.pointerEvents = previous;

    return {
      position: cs.position,
      visible:
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        Number(cs.opacity) > 0.5,
      height: Math.round(r.height),
      parentIsDialog: tip.parentElement === dialog,
      dentroDeModalBox: !!tip.closest(".modal-box"),
      dentroDeVentana:
        r.top >= 0 &&
        r.left >= 0 &&
        r.right <= window.innerWidth &&
        r.bottom <= window.innerHeight,
      cornerHits: corners,
      contenido: (tip.textContent ?? "").trim().length,
    };
  });

const VIEWPORTS = [
  { width: 1280, height: 900, label: "ancho" },
  // <640px DaisyUI pasa el modal a `modal-bottom`: es el caso que recortaba el
  // tooltip contra el borde inferior de la ventana.
  { width: 560, height: 900, label: "angosto (modal-bottom)" },
];

for (const viewport of VIEWPORTS) {
  test(`no queda recortado — viewport ${viewport.label}`, async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await openTerminalWithGroups(page);

    const buttons = page.locator("#terminal-groups-list .license-info-btn");
    const total = await buttons.count();
    expect(total, "debe haber botones de licencia").toBeGreaterThan(0);

    for (let k = 0; k < total; k++) {
      expect(await showTooltip(page, k), `botón ${k} debe existir`).toBe(true);

      const state = await readTooltip(page);
      expect(state, "el tooltip flotante debe existir").not.toBeNull();
      expect(state!.position, "debe ser fixed").toBe("fixed");
      expect(state!.visible, `tooltip ${k} visible`).toBe(true);
      // El .modal-box de DaisyUI define translate/scale (creating block del
      // `fixed`) y tiene overflow: hidden, así que recortaba al tooltip.
      expect(
        state!.parentIsDialog,
        `tooltip ${k} debe colgar del <dialog>`,
      ).toBe(true);
      expect(
        state!.dentroDeModalBox,
        `tooltip ${k} no debe estar dentro del .modal-box`,
      ).toBe(false);
      expect(
        state!.dentroDeVentana,
        `tooltip ${k} dentro de la ventana`,
      ).toBe(true);
      expect(
        state!.height,
        `tooltip ${k} con alto real (no colapsado)`,
      ).toBeGreaterThan(40);
      expect(
        state!.cornerHits,
        `tooltip ${k} sin recortes (4 esquinas pintan el tooltip)`,
      ).toEqual([true, true, true, true]);
      expect(state!.contenido, `tooltip ${k} con contenido`).toBeGreaterThan(0);
    }

    // Al salir del botón se oculta (mouseout sintético, coherente con el show).
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        "#terminal-groups-list .license-info-btn",
      );
      btn?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    await page.waitForTimeout(250);
    await expect(page.locator("#license-tooltip")).toBeHidden();
  });
}
