import "dotenv/config";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles } from "../src/db/schema";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import { expectKbDenied, KbTestFixture, type KbTestMesa } from "./helpers/kb";

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let admin: TestUser;
let agent: TestUser;
let articleId: number;

const submitStatus = async (
  page: import("@playwright/test").Page,
  status: "published" | "archived",
) => {
  await page.locator("#kb-status").selectOption(status);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith(
        `/base-conocimiento/edit/${articleId}`,
      ),
  );
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const response = await responsePromise;
  expect([200, 302]).toContain(response.status());
};

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  admin = await fixture.createUser("admin", mesa);
  agent = await fixture.createUser("agent", mesa);
  const article = await fixture.createArticle({
    mesa,
    authorUserId: admin.userId,
    title: "Ciclo de publicación E2E",
    content: "Contenido inicial.",
    status: "draft",
  });
  articleId = article.id;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test("publica un borrador para su mesa y luego lo archiva", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, admin.signedSessionId);
  await page.goto(`/base-conocimiento/edit/${articleId}`);
  await expect(page.locator("#kb-article-form")).toBeVisible();
  await submitStatus(page, "published");

  await expect(page).toHaveURL(new RegExp(`/base-conocimiento/${articleId}$`));
  await expect(page.locator("#global-toast-container")).toContainText(
    "Artículo publicado con éxito.",
  );
  await expect(
    page.locator("article").getByText("Publicado", { exact: true }),
  ).toBeVisible();

  const [published] = await db
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);
  expect(published).toBeDefined();
  if (!published) throw new Error("Published article was not found");
  expect(published.status).toBe("published");
  expect(published.publishedByUserId).toBe(admin.userId);
  expect(published.publishedAt).toBeInstanceOf(Date);

  const viewResponse = await page.goto(`/base-conocimiento/${articleId}`);
  expect(viewResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Ciclo de publicación E2E" }),
  ).toBeVisible();

  await context.clearCookies();
  await setSessionCookie(context, agent.signedSessionId);
  expectKbDenied(
    await context.request.get("/base-conocimiento", { maxRedirects: 0 }),
  );
  expectKbDenied(
    await context.request.get(`/base-conocimiento/${articleId}`, {
      maxRedirects: 0,
    }),
  );

  await context.clearCookies();
  await setSessionCookie(context, admin.signedSessionId);
  await page.goto(`/base-conocimiento/edit/${articleId}`);
  await submitStatus(page, "archived");
  await expect(page.locator("#global-toast-container")).toContainText(
    "Artículo archivado con éxito.",
  );
  const [archived] = await db
    .select({ status: kbArticles.status })
    .from(kbArticles)
    .where(eq(kbArticles.id, articleId))
    .limit(1);
  expect(archived?.status).toBe("archived");

  await context.clearCookies();
  await setSessionCookie(context, admin.signedSessionId);
  await page.goto("/base-conocimiento");
  const writerArchivedRow = page
    .locator("#kb-articles-table [data-table-row]")
    .filter({
      has: page.getByRole("link", {
        name: "Ciclo de publicación E2E",
        exact: true,
      }),
    });
  await expect(writerArchivedRow).toBeVisible();
  await expect(
    writerArchivedRow.getByText("Archivado", { exact: true }),
  ).toBeVisible();

  await context.clearCookies();
  await setSessionCookie(context, agent.signedSessionId);
  expectKbDenied(
    await context.request.get("/base-conocimiento", { maxRedirects: 0 }),
  );
  expectKbDenied(
    await context.request.get(`/base-conocimiento/${articleId}`, {
      maxRedirects: 0,
    }),
  );
});
