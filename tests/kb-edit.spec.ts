import "dotenv/config";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles } from "../src/db/schema";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import {
  KbTestFixture,
  setEasyMdeContent,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let leader: TestUser;
let articleId: number;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  leader = await fixture.createUser("team_leader", mesa);
  const article = await fixture.createArticle({
    mesa,
    authorUserId: leader.userId,
    title: `Artículo editable ${uniqueToken()}`,
    content: "Contenido original.",
  });
  articleId = article.id;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test("persiste título y contenido después de recargar", async ({
  context,
  page,
}) => {
  const suffix = uniqueToken();
  const updatedTitle = `Título actualizado ${suffix}`;
  const updatedContent = `Contenido actualizado **${suffix}** con Markdown.`;

  await setSessionCookie(context, leader.signedSessionId);
  await page.goto(`/base-conocimiento/edit/${articleId}`);
  await expect(page.locator("#kb-article-form")).toBeVisible();
  await page.locator("#kb-title").fill(updatedTitle);
  await setEasyMdeContent(page, updatedContent);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/base-conocimiento/edit/${articleId}`,
  );
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const response = await responsePromise;
  expect([200, 302]).toContain(response.status());
  await expect(page).toHaveURL(/\/base-conocimiento(?:\?.*)?$/);
  await expect(page.locator("#global-toast-container")).toContainText(
    "Artículo actualizado con éxito.",
  );

  await page.reload();
  const row = page.locator("#kb-articles-table [data-table-row]").filter({
    has: page.getByRole("link", { name: updatedTitle, exact: true }),
  });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: updatedTitle, exact: true }).click();
  const article = page.locator("article");
  await expect(
    article.getByRole("heading", { name: updatedTitle }),
  ).toBeVisible();
  await expect(article.locator("strong")).toHaveText(suffix);

  const [stored] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);
  expect(stored).toBeDefined();
  if (!stored) throw new Error("Edited article was not found");
  expect(stored.title).toBe(updatedTitle);
  expect(stored.content).toBe(updatedContent);
  expect(stored.status).toBe("published");
});

test("rechaza pasar un artículo publicado a borrador sin mutarlo", async ({
  context,
  page,
}) => {
  const [before] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);
  expect(before).toBeDefined();
  if (!before) throw new Error("Article fixture was not found");

  await setSessionCookie(context, leader.signedSessionId);
  await page.goto(`/base-conocimiento/edit/${articleId}`);
  await page.locator("#kb-title").fill(`Cambio inválido ${uniqueToken()}`);
  await page.locator("#kb-status").selectOption("draft");

  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/base-conocimiento/edit/${articleId}`,
  );
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(200);
  await expect(page.locator("#global-toast-container")).toContainText(
    "No se puede volver a borrador. Solo se puede publicar o archivar el artículo.",
  );
  await expect(page).toHaveURL(
    new RegExp(`/base-conocimiento/edit/${articleId}$`),
  );

  const [after] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);
  expect(after).toEqual(before);
});
