import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

const ROUTES = ["/admin/aplicativos", "/admin/contactos", "/admin/recursos"];

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (admin) {
    await cleanupTestUser(admin.userId, admin.sessionId);
  }
});

test.describe("Estados vacíos de las tablas admin", () => {
  for (const route of ROUTES) {
    test(`${route}: la búsqueda sin resultados muestra exactamente un estado`, async ({
      context,
      page,
    }) => {
      await setSessionCookie(context, admin.signedSessionId);

      await page.goto(route, { waitUntil: "load" });
      expect(new URL(page.url()).pathname).toBe(route);
      await page.waitForTimeout(2000);

      const search = page
        .locator("input[type='search']:not(#command-palette-input)")
        .first();
      await search.fill("zzz-no-existe-xyz");
      await page.waitForTimeout(1800);

      const onSearch = await page.evaluate(() => {
        const rendered = (el: Element | null) =>
          !!el &&
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== "hidden";
        const shared = document.querySelector("[data-table-empty-state-root]");
        const category = document.getElementById("category-empty-state");
        return {
          renderedCount: [shared, category].filter(rendered).length,
          sharedRendered: rendered(shared),
          categoryRendered: rendered(category),
        };
      });

      expect(
        onSearch.renderedCount,
        "debe haber exactamente un estado vacío visible",
      ).toBe(1);
      expect(
        onSearch.sharedRendered,
        "debe ser el SearchEmptyState compartido del DataTable",
      ).toBe(true);
      expect(
        onSearch.categoryRendered,
        "el estado de categoría no debe duplicarse con una búsqueda",
      ).toBe(false);

      await search.fill("");
      await page.waitForTimeout(1800);

      const cleared = await page.evaluate(() => {
        const rendered = (el: Element | null) =>
          !!el && el.getClientRects().length > 0;
        const body = document.querySelector("[data-table-sort-body]");
        return {
          rows: body
            ? Array.from(body.querySelectorAll("[data-table-row]")).filter(
                (r) => !r.classList.contains("hidden"),
              ).length
            : 0,
          anyEmptyState: [
            document.querySelector("[data-table-empty-state-root]"),
            document.getElementById("category-empty-state"),
          ].some((el) => rendered(el)),
        };
      });

      expect(cleared.rows, "al limpiar deben volver las filas").toBeGreaterThan(
        0,
      );
      expect(
        cleared.anyEmptyState,
        "con filas visibles no debe haber estado vacío",
      ).toBe(false);
    });
  }
});

test.describe("Estado vacío de grupos de dominio (modal de terminal)", () => {
  test("filtrar grupos sin coincidencias muestra el SearchEmptyState y oculta el listado", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    await page.goto("/buscador-usuarios", { waitUntil: "load" });
    expect(new URL(page.url()).pathname).toBe("/buscador-usuarios");
    await page.waitForTimeout(2500);

    await page.fill("#search-input", "revainera");
    await page.press("#search-input", "Enter");
    await expect(page.locator("#results-grid > *").first()).toBeVisible({
      timeout: 20000,
    });

    await page.locator("#results-grid [data-net-user-btn]").first().click();
    const groupsSearch = page.locator("#terminal-groups-search");
    await expect(groupsSearch).toBeVisible({ timeout: 20000 });

    await groupsSearch.fill("zzz-no-existe-xyz");
    await page.waitForTimeout(1500);

    const filtered = await page.evaluate(() => {
      const rendered = (el: Element | null) =>
        !!el &&
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== "hidden";
      const list = document.getElementById("terminal-groups-list");
      const state = document.getElementById("terminal-groups-empty-state");
      return {
        listRendered: rendered(list),
        stateRendered: rendered(state),
        listHiddenClass: list?.classList.contains("hidden") ?? null,
        title: state?.querySelector('[id$="-title"]')?.textContent?.trim() ?? null,
      };
    });

    expect(filtered.stateRendered, "debe mostrarse el estado vacío").toBe(true);
    expect(filtered.listHiddenClass, "el listado debe ocultarse").toBe(true);
    expect(filtered.listRendered, "el listado no debe pintar").toBe(false);
    expect(filtered.title).toBe("No se encontraron grupos");
  });
});

test.describe("Estados vacíos de las listas de supervisión", () => {
  for (const route of ["/supervision/calidad-operadores", "/supervision/asistencia"]) {
    test(`${route}: la búsqueda sin resultados usa el SearchEmptyState compartido`, async ({
      context,
      page,
    }) => {
      await setSessionCookie(context, admin.signedSessionId);

      await page.goto(route, { waitUntil: "load" });
      expect(new URL(page.url()).pathname).toBe(route);
      await page.waitForTimeout(3500);

      const search = page
        .locator("input[type='search']:not(#command-palette-input)")
        .first();
      await search.fill("zzz-no-existe-xyz");
      await page.waitForTimeout(1800);

      const onSearch = await page.evaluate(() => {
        const rendered = (el: Element | null) =>
          !!el &&
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== "hidden";
        const shared = document.querySelectorAll(
          "[data-table-empty-state-root]",
        );
        return {
          renderedShared: Array.from(shared).filter(rendered).length,
          legacyNoResults: rendered(
            document.getElementById("no-results-msg"),
          ),
        };
      });

      expect(onSearch.renderedShared, "debe mostrar un solo estado compartido")
        .toBe(1);
      expect(
        onSearch.legacyNoResults,
        "no debe quedar el div de resultados propios",
      ).toBe(false);

      // La asistencia no tiene datos en este entorno: su estado de «sin filas»
      // es su estado estable y no depende de la búsqueda.
      if (route === "/supervision/calidad-operadores") {
        await search.fill("");
        await page.waitForTimeout(1800);
        const cleared = await page.evaluate(() => {
          const rendered = (el: Element | null) =>
            !!el &&
            el.getClientRects().length > 0 &&
            getComputedStyle(el).visibility !== "hidden";
          return {
            operators: Array.from(
              document.querySelectorAll(".operator-item"),
            ).filter((o) => rendered(o)).length,
            shared: Array.from(
              document.querySelectorAll("[data-table-empty-state-root]"),
            ).filter((e) => rendered(e)).length,
          };
        });
        expect(cleared.operators, "deben volver los operadores").toBeGreaterThan(
          0,
        );
        expect(cleared.shared, "con operadores no debe quedar estado").toBe(0);
      }
    });
  }
});
