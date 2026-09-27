import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

test.use({ viewport: { width: 1920, height: 1080 } });

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let leader: TestUser;
let articleId: number;
let articleTitle: string;

const contentContainer = (page: Page) => page.locator("main > div").first();

const measure = async (
  locator: ReturnType<Page["locator"]>,
): Promise<number> => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box?.width ?? 0;
};

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  leader = await fixture.createUser("team_leader", mesa);
  articleTitle = `Layout E2E ${uniqueToken()}`;
  const article = await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: articleTitle,
    content: "Contenido de prueba para el layout.",
    status: "published",
  });
  articleId = article.id;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - layout v2", () => {
  test("la lectura ocupa el ancho disponible y limita la prosa", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, leader.signedSessionId);

    await page.goto(`/base-conocimiento/${articleId}`);
    await expect(
      page.getByRole("heading", { name: articleTitle }),
    ).toBeVisible();

    const container = await measure(contentContainer(page));
    expect(container).toBeGreaterThan(1200);

    const body = await measure(page.locator(".kb-article-body"));
    expect(body).toBeLessThanOrEqual(950);
    expect(body).toBeLessThan(container);
  });

  test("la creación ocupa el ancho del editor completo", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, leader.signedSessionId);

    await page.goto("/base-conocimiento/create");
    await expect(
      page.getByRole("heading", { name: "Nuevo artículo" }),
    ).toBeVisible();

    const container = await measure(contentContainer(page));
    expect(container).toBeGreaterThan(1300);
  });

  test("la edición ocupa el ancho del editor completo", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, leader.signedSessionId);

    await page.goto(`/base-conocimiento/edit/${articleId}`);
    await expect(page.locator("#kb-article-form")).toBeVisible();

    const container = await measure(contentContainer(page));
    expect(container).toBeGreaterThan(1300);
  });
});
