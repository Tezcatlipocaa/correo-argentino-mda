import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

test.use({ viewport: { width: 1920, height: 1080 } });

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let leader: TestUser;
let admin: TestUser;
let articleId: number;

const row = (page: Page) => page.locator("[data-kb-fields-row]");
const mesaCell = (page: Page) => row(page).locator("[data-kb-mesa-cell]");

const fieldLabels = async (page: Page): Promise<string[]> => {
  const texts = await row(page).locator(".fieldset-legend").allTextContents();
  return texts.map((text) =>
    text.replace(/\s+/g, " ").replace(/\*/g, "").trim(),
  );
};

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  leader = await fixture.createUser("team_leader", mesa);
  admin = await fixture.createUser("admin", mesa);
  const article = await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: `Fila E2E ${uniqueToken()}`,
    content: "Contenido de prueba para la fila de metadatos.",
    status: "published",
  });
  articleId = article.id;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - fila de metadatos", () => {
  test("creación no-admin: cuatro campos en una fila antes del editor", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, leader.signedSessionId);
    await page.goto("/base-conocimiento/create");
    await expect(
      page.getByRole("heading", { name: "Nuevo artículo" }),
    ).toBeVisible();

    await expect(row(page)).toHaveCount(1);
    expect(await fieldLabels(page)).toEqual([
      "Título",
      "Categoría",
      "Mesa",
      "Estado",
    ]);

    await expect(row(page).locator("#kb-title")).toBeVisible();
    await expect(row(page).locator("#kb-category")).toBeVisible();
    await expect(row(page).locator("#kb-status")).toBeVisible();
    await expect(mesaCell(page)).toBeVisible();
    await expect(mesaCell(page)).toContainText(mesa.name);
    await expect(mesaCell(page).locator("select")).toHaveCount(0);

    const rowBox = await row(page).boundingBox();
    const editorBox = await page
      .locator('label[for="kb-content"]')
      .boundingBox();
    expect(rowBox).not.toBeNull();
    expect(editorBox).not.toBeNull();
    expect(editorBox?.y ?? 0).toBeGreaterThan(rowBox?.y ?? 0);

    const editorPosition = await page.evaluate(() => {
      const fieldsRow = document.querySelector("[data-kb-fields-row]");
      const editor = document.querySelector("#kb-content");
      if (!fieldsRow || !editor) return { following: false, containedBy: true };
      const flags = fieldsRow.compareDocumentPosition(editor);
      return {
        following: Boolean(flags & Node.DOCUMENT_POSITION_FOLLOWING),
        containedBy: Boolean(flags & Node.DOCUMENT_POSITION_CONTAINED_BY),
      };
    });
    expect(editorPosition.following).toBe(true);
    expect(editorPosition.containedBy).toBe(false);
  });

  test("creación admin: la celda Mesa contiene el select de mesas", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento/create");
    await expect(
      page.getByRole("heading", { name: "Nuevo artículo" }),
    ).toBeVisible();

    await expect(row(page)).toHaveCount(1);
    await expect(mesaCell(page).locator("select#kb-helpdesk")).toBeVisible();
    await expect(row(page).locator("#kb-status")).toBeVisible();
  });

  test("edición: Mesa read-only y sin caja de estado actual", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, leader.signedSessionId);
    await page.goto(`/base-conocimiento/edit/${articleId}`);
    await expect(page.locator("#kb-article-form")).toBeVisible();

    await expect(row(page)).toHaveCount(1);
    expect(await fieldLabels(page)).toEqual([
      "Título",
      "Categoría",
      "Mesa",
      "Estado",
    ]);

    await expect(mesaCell(page).locator(".badge")).toBeVisible();
    await expect(mesaCell(page)).toContainText(mesa.name);
    await expect(mesaCell(page).locator("select")).toHaveCount(0);
    await expect(row(page).locator("#kb-status")).toBeVisible();
    await expect(page.getByText("Estado actual")).toHaveCount(0);
  });
});
