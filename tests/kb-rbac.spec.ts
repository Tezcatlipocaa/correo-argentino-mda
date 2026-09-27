import "dotenv/config";
import { expect, test } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import { KbTestFixture, uniqueToken, type KbTestMesa } from "./helpers/kb";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let fixture: KbTestFixture;
let agentMesa: KbTestMesa;
let otherMesa: KbTestMesa;
let agent: TestUser;
let otherLeader: TestUser;
let agentMesaArticleId: number;
let agentMesaArticleTitle: string;
let sameMesaDraftId: number;
let sameMesaDraftTitle: string;
let otherArticleId: number;

const expectUnauthorizedRedirect = (response: {
  status(): number;
  headers(): Record<string, string>;
}) => {
  expect(response.status()).toBe(302);
  const location = new URL(
    response.headers().location,
    "http://localhost:4322",
  );
  expect(location.pathname).toBe("/");
  expect(location.searchParams.get("toast_msg")).toBe("Acceso no autorizado");
  expect(location.searchParams.get("toast_type")).toBe("error");
};

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  agentMesa = await fixture.createMesa();
  otherMesa = await fixture.createMesa();
  agent = await fixture.createUser("agent", agentMesa);
  const sameMesaLeader = await fixture.createUser("team_leader", agentMesa);
  otherLeader = await fixture.createUser("team_leader", otherMesa);

  const suffix = uniqueToken();
  agentMesaArticleTitle = `Artículo de mesa A ${suffix}`;
  const agentMesaArticle = await fixture.createArticle({
    mesa: agentMesa,
    authorUserId: sameMesaLeader.userId,
    title: agentMesaArticleTitle,
    content: "Contenido de mesa A.",
  });
  agentMesaArticleId = agentMesaArticle.id;

  sameMesaDraftTitle = `Borrador de mesa A ${suffix}`;
  const sameMesaDraft = await fixture.createArticle({
    mesa: agentMesa,
    authorUserId: sameMesaLeader.userId,
    title: sameMesaDraftTitle,
    content: "Borrador de mesa A.",
    status: "draft",
  });
  sameMesaDraftId = sameMesaDraft.id;

  const otherArticle = await fixture.createArticle({
    mesa: otherMesa,
    authorUserId: otherLeader.userId,
    title: `Artículo de mesa B ${suffix}`,
    content: "Contenido de mesa B.",
  });
  otherArticleId = otherArticle.id;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - RBAC de agente", () => {
  test.beforeEach(async ({ context }) => {
    await setSessionCookie(context, agent.signedSessionId);
  });

  test("no abre el formulario de creación con denegación autenticada", async ({
    context,
    page,
  }) => {
    const denial = await context.request.get("/base-conocimiento/create", {
      maxRedirects: 0,
    });
    expectUnauthorizedRedirect(denial);

    await page.goto("/base-conocimiento/create");
    await expect(page.locator("#global-toast-container")).toContainText(
      "Acceso no autorizado",
    );
    await expect(page.locator("#kb-article-form")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Nuevo artículo" }),
    ).toHaveCount(0);
  });

  test("no muestra la acción Nuevo artículo", async ({ page }) => {
    await page.goto("/base-conocimiento");

    await expect(page.locator("#base-conocimiento-root")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nuevo artículo", exact: true }),
    ).toHaveCount(0);
  });

  test("devuelve 404 para un artículo de otra mesa", async ({ page }) => {
    const response = await page.goto(`/base-conocimiento/${otherArticleId}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Página no encontrada")).toBeVisible();
  });

  test("devuelve 404 para un borrador de su misma mesa", async ({ page }) => {
    const response = await page.goto(`/base-conocimiento/${sameMesaDraftId}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Página no encontrada")).toBeVisible();
  });

  test("recibe 302 al intentar subir una imagen", async ({ context }) => {
    const response = await context.request.post("/api/kb/upload", {
      maxRedirects: 0,
      multipart: {
        file: {
          name: "pixel.png",
          mimeType: "image/png",
          buffer: PNG_1X1,
        },
      },
    });

    expectUnauthorizedRedirect(response);
  });
});

test("un writer no admin de mesa B queda limitado a su mesa", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, otherLeader.signedSessionId);
  await page.goto("/base-conocimiento");

  await expect(
    page.getByRole("link", { name: agentMesaArticleTitle, exact: true }),
  ).toHaveCount(0);

  const foreignViewResponse = await page.goto(
    `/base-conocimiento/${agentMesaArticleId}`,
  );
  expect(foreignViewResponse?.status()).toBe(404);
  const foreignEditResponse = await page.goto(
    `/base-conocimiento/edit/${agentMesaArticleId}`,
  );
  expect(foreignEditResponse?.status()).toBe(404);
  await expect(page.locator("#kb-article-form")).toHaveCount(0);

  await context.clearCookies();
  await setSessionCookie(context, otherLeader.signedSessionId);
  const uploadResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "writer-pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
    },
  });
  const payload = (await uploadResponse.json()) as { url?: string };
  expect(uploadResponse.status()).toBe(200);
  if (!payload.url) throw new Error("Writer upload did not return a URL");
  expect(payload.url).toMatch(
    new RegExp(`^/api/kb/images/${otherMesa.invgateId}/`),
  );
  fixture.trackImageUrl(payload.url, otherMesa.invgateId);
});
