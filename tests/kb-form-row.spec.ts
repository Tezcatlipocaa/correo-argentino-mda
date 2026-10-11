import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import {
  expectKbDenied,
  KbTestFixture,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

test.use({ viewport: { width: 1920, height: 1080 } });

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let leader: TestUser;
let admin: TestUser;
let articleId: number;

const row = (page: Page) => page.locator("[data-kb-fields-row]");
const mesaCell = (page: Page) => row(page).locator("[data-kb-mesa-cell]");
const categoryLink = (page: Page) =>
  page.getByRole("link", { name: "Administrar categorías" });

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
  test("creación de un no-admin es denegada", async ({ context, page }) => {
    await setSessionCookie(context, leader.signedSessionId);

    const denial = await context.request.get("/base-conocimiento/create", {
      maxRedirects: 0,
    });
    expectKbDenied(denial);

    await page.goto("/base-conocimiento/create");
    await expect(page.locator("#kb-article-form")).toHaveCount(0);
    await expect(page.locator("#global-toast-container")).toContainText(
      "Acceso no autorizado",
    );
  });

  test("creación admin: fila de metadatos antes del editor y select de mesas", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
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
    await expect(mesaCell(page).locator("select#kb-helpdesk")).toBeVisible();
    await expect(row(page).locator("#kb-status")).toBeVisible();

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

  test("edición: Mesa read-only y sin caja de estado actual", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
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

  test("creación: el link de categorías queda fuera de la fila y los campos alinean", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto("/base-conocimiento/create");
    await expect(page.locator("#kb-article-form")).toBeVisible();

    await expect(categoryLink(page)).toBeVisible();
    await expect(
      row(page).getByRole("link", { name: "Administrar categorías" }),
    ).toHaveCount(0);

    const titleBox = await page.locator("#kb-title").boundingBox();
    const categoryBox = await page.locator("#kb-category").boundingBox();
    const mesaBox = await mesaCell(page).boundingBox();
    const statusBox = await page.locator("#kb-status").boundingBox();
    const linkBox = await categoryLink(page).boundingBox();

    expect(titleBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(mesaBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(linkBox).not.toBeNull();

    expect(Math.abs(titleBox!.y - categoryBox!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(titleBox!.y - statusBox!.y)).toBeLessThanOrEqual(2);
    expect(linkBox!.y).toBeGreaterThan(titleBox!.y);
  });

  test("edición: el link de categorías queda fuera de la fila y los campos alinean", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.goto(`/base-conocimiento/edit/${articleId}`);
    await expect(page.locator("#kb-article-form")).toBeVisible();

    await expect(categoryLink(page)).toBeVisible();
    await expect(
      row(page).getByRole("link", { name: "Administrar categorías" }),
    ).toHaveCount(0);

    const titleBox = await page.locator("#kb-title").boundingBox();
    const categoryBox = await page.locator("#kb-category").boundingBox();
    const mesaBox = await mesaCell(page).boundingBox();
    const statusBox = await page.locator("#kb-status").boundingBox();
    const linkBox = await categoryLink(page).boundingBox();

    expect(titleBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(mesaBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(linkBox).not.toBeNull();

    expect(Math.abs(titleBox!.y - categoryBox!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(titleBox!.y - statusBox!.y)).toBeLessThanOrEqual(2);
    expect(linkBox!.y).toBeGreaterThan(titleBox!.y);
  });
});
