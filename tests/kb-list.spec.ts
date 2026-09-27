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
    const agent = await fixture.createUser("agent", mesa);
    const otherMesa = await fixture.createMesa();
    const otherLeader = await fixture.createUser("team_leader", otherMesa);
    const foreignTitle = `Publicado ajeno ${suffix}`;
    await fixture.createArticle({
      mesa,
      authorUserId: agent.userId,
      title,
      category,
    });
    await fixture.createArticle({
      mesa: otherMesa,
      authorUserId: otherLeader.userId,
      title: foreignTitle,
      category: `Categoría ajena ${suffix}`,
    });

    await setSessionCookie(context, agent.signedSessionId);
    await page.goto("/base-conocimiento");

    const row = articleRow(page, title);
    await expect(row).toBeVisible();
    await expect(row).toContainText(category);
    await expect(articleRow(page, foreignTitle)).toHaveCount(0);
    await expect(
      page.locator("#kb-articles-table [data-table-header]"),
    ).not.toContainText("Mesa");
  });

  test("oculta borradores a un agente sin permisos de escritura", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const publishedTitle = `Publicado para agente ${suffix}`;
    const draftTitle = `Borrador privado ${suffix}`;
    const agent = await fixture.createUser("agent", mesa);
    await fixture.createArticle({
      mesa,
      authorUserId: agent.userId,
      title: publishedTitle,
      content: "Contenido publicado.",
    });
    await fixture.createArticle({
      mesa,
      authorUserId: agent.userId,
      title: draftTitle,
      content: "Contenido en borrador.",
      status: "draft",
    });

    await setSessionCookie(context, agent.signedSessionId);
    await page.goto("/base-conocimiento");

    await expect(articleRow(page, publishedTitle)).toBeVisible();
    await expect(
      page.getByRole("link", { name: draftTitle, exact: true }),
    ).toHaveCount(0);
  });

  test("renderiza empty state cuando la mesa no tiene artículos", async ({
    context,
    page,
  }) => {
    const agent = await fixture.createUser("agent", mesa);
    await setSessionCookie(context, agent.signedSessionId);

    await page.goto("/base-conocimiento");

    const root = page.locator("#base-conocimiento-root");
    await expect(root).toBeVisible();
    await expect(
      root.getByText("No hay artículos", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#kb-articles-search")).toHaveCount(0);
  });

  test("filtra filas por título y categoría", async ({ context, page }) => {
    const suffix = uniqueToken();
    const matchingTitle = `Filtro coincidencia ${suffix}`;
    const matchingCategory = `Accesos ${suffix}`;
    const otherTitle = `Filtro distinto ${suffix}`;
    const agent = await fixture.createUser("agent", mesa);
    await fixture.createArticle({
      mesa,
      authorUserId: agent.userId,
      title: matchingTitle,
      category: matchingCategory,
    });
    await fixture.createArticle({
      mesa,
      authorUserId: agent.userId,
      title: otherTitle,
      category: `Impresoras ${suffix}`,
    });

    await setSessionCookie(context, agent.signedSessionId);
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
});
