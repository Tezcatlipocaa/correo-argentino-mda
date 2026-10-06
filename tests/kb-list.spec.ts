import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

let fixture: KbTestFixture;
let mesa: KbTestMesa;

const articleRow = (page: Page, title: string) =>
  page
    .locator("#kb-articles-table [data-table-row]")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - listado", () => {
  test("muestra título y categoría de un artículo publicado", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const title = `Publicado visible ${suffix}`;
    const category = `Categoría ${suffix}`;
    const admin = await fixture.createUser("admin", mesa);
    const otherMesa = await fixture.createMesa();
    const otherLeader = await fixture.createUser("team_leader", otherMesa);
    const foreignTitle = `Publicado ajeno ${suffix}`;
    await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title,
      category,
    });
    await fixture.createArticle({
      mesa: otherMesa,
      authorUserId: otherLeader.userId,
      title: foreignTitle,
      category: `Categoría ajena ${suffix}`,
    });

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento");

    const row = articleRow(page, title);
    await expect(row).toBeVisible();
    await expect(row).toContainText(category);
    await expect(articleRow(page, foreignTitle)).toBeVisible();
    await expect(
      page.locator("#kb-articles-table [data-table-header]"),
    ).toContainText("Mesa");
  });

  test("filtra filas por título y categoría", async ({ context, page }) => {
    const suffix = uniqueToken();
    const matchingTitle = `Filtro coincidencia ${suffix}`;
    const matchingCategory = `Accesos ${suffix}`;
    const otherTitle = `Filtro distinto ${suffix}`;
    const admin = await fixture.createUser("admin", mesa);
    await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title: matchingTitle,
      category: matchingCategory,
    });
    await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title: otherTitle,
      category: `Impresoras ${suffix}`,
    });

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento");

    const matchingRow = articleRow(page, matchingTitle);
    const otherRow = articleRow(page, otherTitle);
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).toBeVisible();

    const search = page.locator("#kb-articles-search");
    await search.fill(matchingCategory);
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).toBeHidden();

    await search.fill("");
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).toBeVisible();

    await search.fill(matchingTitle);
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).toBeHidden();

    await search.fill(`Sin coincidencias ${suffix}`);
    await expect(matchingRow).toBeHidden();
    await expect(otherRow).toBeHidden();
    await expect(
      page.getByText(
        "No encontramos artículos para esa búsqueda. Probá con otros términos.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("muestra el empty state de búsqueda cuando no hay coincidencias", async ({
    context,
    page,
  }) => {
    const admin = await fixture.createUser("admin", mesa);
    await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title: `Artículo buscable ${uniqueToken()}`,
    });

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento");

    await page
      .locator("#kb-articles-search")
      .fill(`sin-coincidencias-${uniqueToken()}`);

    await expect(
      page.getByText("Sin artículos", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "No encontramos artículos para esa búsqueda. Probá con otros términos.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.locator("#kb-articles-table [data-table-row]:visible"),
    ).toHaveCount(0);
  });

  test("las acciones de fila usan la familia compartida y miden igual", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const title = `Botones fila ${suffix}`;
    const admin = await fixture.createUser("admin", mesa);
    await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title,
      category: `Categoría ${suffix}`,
    });

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento");

    const row = articleRow(page, title);
    const edit = row.getByRole("link", { name: `Editar ${title}` });
    const view = row.getByRole("link", { name: `Ver ${title}` });
    await expect(edit).toBeVisible();
    await expect(view).toBeVisible();

    const editBox = await edit.boundingBox();
    const viewBox = await view.boundingBox();
    expect(Math.round(editBox?.height ?? 0)).toBe(Math.round(viewBox?.height ?? 0));

    const iconHeights = await Promise.all(
      [edit, view].map((locator) =>
        locator
          .locator("svg")
          .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
      ),
    );
    expect(iconHeights).toEqual([14, 14]);

    await expect(view).toHaveClass(/btn-xs/);
    await expect(view).toHaveClass(/btn-soft/);
    await expect(view).toHaveClass(/btn-accent/);
    await expect(edit).toHaveClass(/btn-xs/);
  });

  test("los botones de crear y editar artículo usan la familia compartida", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const title = `Botones header ${suffix}`;
    const admin = await fixture.createUser("admin", mesa);
    const article = await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title,
      category: `Categoría ${suffix}`,
    });

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento");

    const create = page.getByRole("link", { name: "Nuevo artículo" });
    await expect(create).toBeVisible();
    await expect(create).toHaveClass(/btn-primary/);
    await expect(create).toHaveClass(/btn-sm/);
    const createIconHeight = await create
      .locator("svg")
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    expect(createIconHeight).toBe(16);

    await page.goto(`/base-conocimiento/${article.id}`);
    const editHeader = page.getByRole("link", { name: "Editar artículo" });
    await expect(editHeader).toBeVisible();
    await expect(editHeader).toHaveClass(/btn-soft/);
    await expect(editHeader).toHaveClass(/btn-secondary/);
    const editIconHeight = await editHeader
      .locator("svg")
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    expect(editIconHeight).toBe(18);
  });

  // NOTA: el empty state server-side "No hay artículos" (SearchEmptyState en
  // KbListContent.astro cuando `articles.length === 0`) NO se cubre a propósito.
  // Bajo la política admin-only, un admin tiene scope global, por lo que una
  // mesa recién creada sigue viendo artículos de otras mesas y el conjunto
  // global vacío es inalcanzable con los fixtures E2E. La cobertura del empty
  // state queda cubierta del lado cliente por el test de búsqueda sin
  // coincidencias.
});
