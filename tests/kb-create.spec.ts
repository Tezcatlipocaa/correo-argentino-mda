import "dotenv/config";
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import {
  KbTestFixture,
  setEasyMdeContent,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

let fixture: KbTestFixture;
let mesa: KbTestMesa;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - creación", () => {
  test("team_leader guarda un borrador y vuelve al listado", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const title = `Borrador E2E ${suffix}`;
    const markdown = `Procedimiento **${suffix}** con contenido Markdown.`;
    const leader = await fixture.createUser("team_leader", mesa);

    await setSessionCookie(context, leader.signedSessionId);
    await page.goto("/base-conocimiento/create");

    await expect(
      page.getByRole("heading", { name: "Nuevo artículo" }),
    ).toBeVisible();
    await page.locator("#kb-title").fill(title);
    await expect(page.locator("#kb-status")).toHaveValue("draft");
    await setEasyMdeContent(page, markdown);

    const submitResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/base-conocimiento/create",
    );
    await page.getByRole("button", { name: "Crear artículo" }).click();
    const submitResponse = await submitResponsePromise;

    expect([200, 302]).toContain(submitResponse.status());

    const [article] = await db
      .select()
      .from(kbArticles)
      .where(
        and(
          eq(kbArticles.helpdeskId, mesa.invgateId),
          eq(kbArticles.authorUserId, leader.userId),
          eq(kbArticles.title, title),
        ),
      )
      .limit(1);

    expect(article).toBeDefined();
    if (!article) throw new Error("Created article was not found");
    fixture.trackArticle(article.id);
    expect(article).toMatchObject({
      status: "draft",
      helpdeskId: mesa.invgateId,
      authorUserId: leader.userId,
      content: markdown,
    });

    await expect(page).toHaveURL(/\/base-conocimiento(?:\?.*)?$/);
    await expect(page.locator("#global-toast-container")).toContainText(
      "Artículo creado con éxito.",
    );
    const row = page
      .locator("#kb-articles-table [data-table-row]")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await expect(row).toBeVisible();

    const agent = await fixture.createUser("agent", mesa);
    await context.clearCookies();
    await setSessionCookie(context, agent.signedSessionId);
    await page.goto("/base-conocimiento");
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
    const agentViewResponse = await page.goto(
      `/base-conocimiento/${article.id}`,
    );
    expect(agentViewResponse?.status()).toBe(404);
  });

  test("rechaza contenido vacío y no crea una fila", async ({
    context,
    page,
  }) => {
    const suffix = uniqueToken();
    const title = `Contenido vacío E2E ${suffix}`;
    const leader = await fixture.createUser("team_leader", mesa);

    await setSessionCookie(context, leader.signedSessionId);
    await page.goto("/base-conocimiento/create");

    await page.locator("#kb-title").fill(title);
    await setEasyMdeContent(page, "   \n\t  ");
    await page.getByRole("button", { name: "Crear artículo" }).click();

    await expect(
      page.getByText("El contenido del artículo es obligatorio."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/base-conocimiento\/create$/);

    const rows = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(
        and(
          eq(kbArticles.helpdeskId, mesa.invgateId),
          eq(kbArticles.authorUserId, leader.userId),
          eq(kbArticles.title, title),
        ),
      );

    expect(rows).toEqual([]);
  });
});
