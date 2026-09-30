import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles } from "../src/db/schema";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import { expectKbDenied, KbTestFixture, uniqueToken } from "./helpers/kb";

let fixture: KbTestFixture;
let ownArticleId: number;
let foreignArticleId: number;
let otherMesaName: string;
let foreignArticleTitle: string;
let adminUser: TestUser;
let otherAgent: TestUser;

const articleRow = (page: Page, title: string) =>
  page
    .locator("#kb-articles-table [data-table-row]")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  const adminMesa = await fixture.createMesa();
  const otherMesa = await fixture.createMesa();
  adminUser = await fixture.createUser("admin", adminMesa);
  otherAgent = await fixture.createUser("agent", otherMesa);
  const otherLeader = await fixture.createUser("team_leader", otherMesa);

  const ownArticle = await fixture.createArticle({
    mesa: otherMesa,
    authorUserId: otherAgent.userId,
    title: `Artículo propio del agente ${uniqueToken()}`,
    content: "Contenido publicado de mesa B.",
  });
  const foreignArticle = await fixture.createArticle({
    mesa: otherMesa,
    authorUserId: otherLeader.userId,
    title: `Borrador de mesa B ${uniqueToken()}`,
    category: `Mesa externa ${uniqueToken()}`,
    content: "Borrador visible para administración.",
    status: "draft",
  });
  ownArticleId = ownArticle.id;
  foreignArticleId = foreignArticle.id;
  otherMesaName = otherMesa.name;
  foreignArticleTitle = foreignArticle.title;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test("admin de mesa A lista, ve y edita un borrador de mesa B", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  await page.goto("/base-conocimiento");

  await expect(
    page.locator("#kb-articles-table [data-table-header]"),
  ).toContainText("Mesa");
  const row = articleRow(page, foreignArticleTitle);
  await expect(row).toBeVisible();
  await expect(row).toContainText(otherMesaName);

  await row
    .getByRole("link", { name: foreignArticleTitle, exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/base-conocimiento/${foreignArticleId}$`),
  );
  const article = page.locator("article");
  await expect(
    article.getByRole("heading", { name: foreignArticleTitle }),
  ).toBeVisible();
  await expect(article.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(article.getByText(otherMesaName, { exact: true })).toBeVisible();

  const updatedTitle = `Borrador editado ${uniqueToken()}`;
  await page.goto(`/base-conocimiento/edit/${foreignArticleId}`);
  await expect(page.locator("#kb-article-form")).toBeVisible();
  await page.locator("#kb-title").fill(updatedTitle);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/base-conocimiento/edit/${foreignArticleId}`,
  );
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const response = await responsePromise;
  expect([200, 302]).toContain(response.status());
  await expect(page.locator("#global-toast-container")).toContainText(
    "Artículo actualizado con éxito.",
  );

  await page.reload();
  await expect(articleRow(page, updatedTitle)).toBeVisible();
  await expect(articleRow(page, foreignArticleTitle)).toHaveCount(0);

  const [stored] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, foreignArticleId))
    .limit(1);
  expect(stored).toBeDefined();
  expect(stored?.title).toBe(updatedTitle);
  expect(stored?.status).toBe("draft");
});

test("un no-admin es rechazado al intentar ver o editar el artículo ajeno", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, otherAgent.signedSessionId);

  const foreignView = await context.request.get(
    `/base-conocimiento/${foreignArticleId}`,
    { maxRedirects: 0 },
  );
  expectKbDenied(foreignView);

  const editDenial = await context.request.get(
    `/base-conocimiento/edit/${ownArticleId}`,
    { maxRedirects: 0 },
  );
  expectKbDenied(editDenial);

  await page.goto(`/base-conocimiento/edit/${ownArticleId}`);
  await expect(page.locator("#kb-article-form")).toHaveCount(0);
  await expect(page.locator("#global-toast-container")).toContainText(
    "Acceso no autorizado",
  );
});
