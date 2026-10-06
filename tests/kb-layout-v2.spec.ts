import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import {
  KbTestFixture,
  setEasyMdeContent,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

test.use({ viewport: { width: 1920, height: 1080 } });

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let admin: TestUser;
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
  admin = await fixture.createUser("admin", mesa);
  articleTitle = `Layout E2E ${uniqueToken()}`;
  const article = await fixture.createArticle({
    mesa,
    authorUserId: admin.userId,
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
    await setSessionCookie(context, admin.signedSessionId);

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
    await setSessionCookie(context, admin.signedSessionId);

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
    await setSessionCookie(context, admin.signedSessionId);

    await page.goto(`/base-conocimiento/edit/${articleId}`);
    await expect(page.locator("#kb-article-form")).toBeVisible();

    const container = await measure(contentContainer(page));
    expect(container).toBeGreaterThan(1300);
  });

  test("los encabezados h1-h6 tienen una escala descendente", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const content = [
      `# Uno ${suffix}`,
      `## Dos ${suffix}`,
      `### Tres ${suffix}`,
      `#### Cuatro ${suffix}`,
      `##### Cinco ${suffix}`,
      `###### Seis ${suffix}`,
      `Párrafo ${suffix}`,
    ].join("\n\n");
    const article = await fixture.createArticle({
      mesa,
      authorUserId: admin.userId,
      title: `Tipografía ${suffix}`,
      content,
      status: "published",
    });

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto(`/base-conocimiento/${article.id}`);

    const body = page.locator(".kb-article-body");
    await expect(body.locator("h6")).toBeVisible();

    const sizes: number[] = [];
    for (let level = 1; level <= 6; level += 1) {
      sizes.push(
        parseFloat(
          await body
            .locator(`h${level}`)
            .evaluate((el) => getComputedStyle(el).fontSize),
        ),
      );
    }
    expect(sizes).toEqual([36, 28, 22, 18, 16, 14]);

    const paragraphSize = parseFloat(
      await body
        .locator("p")
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
    );
    expect(sizes[sizes.length - 1]).toBeLessThanOrEqual(paragraphSize);
  });

  test("la vista previa del editor replica la escala de encabezados", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const content = [
      `# Uno ${suffix}`,
      `## Dos ${suffix}`,
      `### Tres ${suffix}`,
      `#### Cuatro ${suffix}`,
      `##### Cinco ${suffix}`,
      `###### Seis ${suffix}`,
    ].join("\n\n");

    await setSessionCookie(context, admin.signedSessionId);
    await page.goto(`/base-conocimiento/edit/${articleId}`);
    await expect(page.locator("#kb-article-form")).toBeVisible();
    await setEasyMdeContent(page, content);

    await page
      .locator(".EasyMDEContainer .editor-toolbar button.preview")
      .click();
    const preview = page.locator(".EasyMDEContainer .editor-preview-full");
    await expect(preview).toBeVisible();
    await expect(preview.locator("h6")).toBeVisible();

    const sizes: number[] = [];
    for (let level = 1; level <= 6; level += 1) {
      sizes.push(
        parseFloat(
          await preview
            .locator(`h${level}`)
            .first()
            .evaluate((el) => getComputedStyle(el).fontSize),
        ),
      );
    }
    expect(sizes).toEqual([36, 28, 22, 18, 16, 14]);
  });
});
