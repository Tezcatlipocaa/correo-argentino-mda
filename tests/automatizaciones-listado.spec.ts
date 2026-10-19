import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * Listado de /automatizaciones: filtros, toggle de vista (tarjetas/tabla) y
 * "datos al". Tolerante a bases sin historial cargado.
 */

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let adminUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
});

test.describe("Listado de /automatizaciones", () => {
  test("agent accede al listado", async ({ context, page }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones");
    await expect(
      page.getByRole("heading", { name: "Automatizaciones", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Vista del listado" }),
    ).toBeVisible();
  });

  test("toggle de vista tabla", async ({ context, page }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones?view=table");

    const empty = page.getByText(/No hay automatizaciones/);
    const shell = page.locator(".table-shell");
    await expect(shell.or(empty).first()).toBeVisible();
    test.skip(
      (await shell.count()) === 0,
      "Sin automatizaciones cargadas: no hay tabla que verificar.",
    );

    // La vista de tabla usa el shell estándar con una tabla real.
    await expect(shell.locator("table thead th").first()).toBeVisible();
    await expect(shell.locator("tbody tr[data-table-row]").first()).toBeVisible();
    // Las celdas declaran data-label para el apilado en mobile.
    await expect(
      shell.locator("tbody tr[data-table-row] td[data-label]").first(),
    ).toBeVisible();

    // El ordenamiento client-side queda cableado: click en una cabecera
    // ordenable y el control refleja la dirección aplicada.
    const sortControl = shell.locator("[data-table-sort-key='sucursal']");
    await sortControl.click();
    await expect(sortControl).toHaveAttribute("aria-sort", "ascending");
    const rowCountBefore = await shell
      .locator("tbody tr[data-table-row]")
      .count();
    await sortControl.click();
    await expect(sortControl).toHaveAttribute("aria-sort", "descending");
    await expect(shell.locator("tbody tr[data-table-row]")).toHaveCount(
      rowCountBefore,
    );

    // El orden que devuelve el server (order=oldest) no debe ser pisado por
    // el cliente mientras el usuario no toca una cabecera.
    await page.goto("/automatizaciones?view=table&order=oldest");
    const startedAt = await shell
      .locator("tbody tr[data-table-row]")
      .evaluateAll((rows) =>
        rows.map((row) => Number(row.getAttribute("data-sort-iniciada"))),
      );
    expect(startedAt.length).toBeGreaterThan(1);
    expect([...startedAt].sort((a, b) => a - b)).toEqual(startedAt);

    await expect(page.getByRole("link", { name: "Tarjetas" })).toBeVisible();
  });

  test("abre el drawer de filtros", async ({ context, page }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/automatizaciones");

    const openBtn = page.locator("[data-open-filters]");
    test.skip(
      (await openBtn.count()) === 0,
      "Sin listado cargado: no hay botón de filtros.",
    );

    await openBtn.first().click();
    const dialog = page.getByRole("dialog", { name: "Filtros del listado" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('select[name="status"]')).toBeVisible();
    await expect(dialog.locator('select[name="region"]')).toBeVisible();
    await expect(dialog.locator('select[name="age"]')).toBeVisible();
    await expect(dialog.locator('input[name="from"]')).toBeVisible();
    await expect(dialog.locator('input[name="to"]')).toBeVisible();
    await expect(dialog.locator('select[name="order"]')).toBeVisible();

    // "Aplicar filtros" asocia los selects (atributo form) y recarga con el filtro.
    await dialog.locator('select[name="age"]').selectOption("30+");
    await dialog.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.waitForURL(/[?&]age=30/);
  });

  test("filtros de región/antigüedad/orden responden 200", async ({
    context,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    for (const qs of [
      "status=active",
      "status=active&age=30%2B&order=oldest",
      "view=table&order=updated",
    ]) {
      const response = await context.request.get(`/automatizaciones?${qs}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
    }
  });

  test("la cabecera no ofrece el CTA de Reportes de workflows", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/automatizaciones");

    await expect(
      page.getByRole("heading", { name: "Automatizaciones", level: 1 }),
    ).toBeVisible();

    // La barra de acciones (donde vivía el CTA) solo se renderiza con listado
    // cargado: sin datos el test pasaría vacuo, así que se salta.
    const exportBtn = page.getByRole("link", { name: "Exportar CSV" });
    test.skip(
      (await exportBtn.count()) === 0,
      "Sin listado cargado: no hay barra de acciones.",
    );
    await expect(exportBtn).toBeVisible();

    await expect(page.locator("[data-cta-reportes-workflows]")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Reportes", exact: true }),
    ).toHaveCount(0);
  });
});
