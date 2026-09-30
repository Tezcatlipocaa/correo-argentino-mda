import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "../helpers/auth";
import { KbTestFixture, uniqueToken } from "../helpers/kb";

let fixture: KbTestFixture;
let adminUser: TestUser;
let agentUser: TestUser;
let articleTitle: string;

const articleRow = (page: Page, title: string) =>
  page
    .locator("#kb-articles-table [data-table-row]")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  const mesa = await fixture.createMesa();
  adminUser = await fixture.createUser("admin", mesa);
  agentUser = await fixture.createUser("agent", mesa);
  articleTitle = `Navegación KB ${uniqueToken()}`;
  await fixture.createArticle({
    mesa,
    authorUserId: adminUser.userId,
    title: articleTitle,
    content: "Artículo para verificar la isla diferida.",
  });
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Sección Base de conocimiento", () => {
  test("admin ve la lista diferida", async ({ context, page }) => {
    await setSessionCookie(context, adminUser.signedSessionId);
    await page.goto("/base-conocimiento");

    const root = page.locator("#base-conocimiento-root");
    await expect(root).toBeVisible();
    await expect(articleRow(page, articleTitle)).toBeVisible();
  });

  test("un agente NO ve el enlace y es redirigido", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    await page.goto("/base-conocimiento");
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.locator("#global-toast-container")).toContainText(
      "Acceso no autorizado",
    );

    await expect(page.locator("#base-conocimiento-root")).toHaveCount(0);
  });
});
