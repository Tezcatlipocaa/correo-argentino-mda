import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import {
  expectKbDenied,
  KbTestFixture,
  uniqueToken,
  type KbTestMesa,
} from "./helpers/kb";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const NON_ADMIN_ROLES = [
  "agent",
  "referent",
  "team_leader",
  "supervisor",
] as const;

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let admin: TestUser;
let articleId: number;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  admin = await fixture.createUser("admin", mesa);
  const article = await fixture.createArticle({
    mesa,
    authorUserId: admin.userId,
    title: `Artículo RBAC ${uniqueToken()}`,
    content: "Contenido para la política admin-only.",
  });
  articleId = article.id;
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - política admin-only", () => {
  for (const role of NON_ADMIN_ROLES) {
    test(`un ${role} es redirigido en todas las rutas de la base de conocimiento`, async ({
      context,
      page,
    }) => {
      const user = await fixture.createUser(role, mesa);
      await setSessionCookie(context, user.signedSessionId);

      const pagePaths = [
        "/base-conocimiento",
        "/base-conocimiento/create",
        "/base-conocimiento/categorias",
        `/base-conocimiento/${articleId}`,
      ];
      for (const path of pagePaths) {
        const denial = await context.request.get(path, { maxRedirects: 0 });
        expectKbDenied(denial);
      }

      const upload = await context.request.post("/api/kb/upload", {
        maxRedirects: 0,
        multipart: {
          file: {
            name: "pixel.png",
            mimeType: "image/png",
            buffer: PNG_1X1,
          },
        },
      });
      expectKbDenied(upload);

      const image = await context.request.get(
        `/api/kb/images/${mesa.invgateId}/${randomUUID()}.webp`,
        { maxRedirects: 0 },
      );
      expectKbDenied(image);

      await page.goto("/base-conocimiento");
      await expect(page.locator("#base-conocimiento-root")).toHaveCount(0);
      await expect(page.locator("#global-toast-container")).toContainText(
        "Acceso no autorizado",
      );
    });
  }

  test("un admin lista, abre el alta y el ABM de categorías", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    const list = await context.request.get("/base-conocimiento", {
      maxRedirects: 0,
    });
    expect(list.status()).toBe(200);
    await page.goto("/base-conocimiento");
    await expect(page.locator("#base-conocimiento-root")).toBeVisible();

    await page.goto("/base-conocimiento/create");
    await expect(page.locator("#kb-article-form")).toBeVisible();

    const categorias = await context.request.get(
      "/base-conocimiento/categorias",
      { maxRedirects: 0 },
    );
    expect(categorias.status()).toBe(200);
  });

  test("un admin accede a un artículo de cualquier mesa", async ({ page }) => {
    await setSessionCookie(page.context(), admin.signedSessionId);
    const otherMesa = await fixture.createMesa();
    const otherAdmin = await fixture.createUser("admin", otherMesa);
    const foreign = await fixture.createArticle({
      mesa: otherMesa,
      authorUserId: otherAdmin.userId,
      title: `Artículo ajeno ${uniqueToken()}`,
      content: "Contenido de otra mesa.",
    });

    const response = await page.goto(`/base-conocimiento/${foreign.id}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: foreign.title }),
    ).toBeVisible();
  });
});
