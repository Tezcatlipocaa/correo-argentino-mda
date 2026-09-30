import "dotenv/config";
import { expect, test } from "@playwright/test";
import { setSessionCookie } from "./helpers/auth";
import { KbTestFixture, setEasyMdeContent, uniqueToken } from "./helpers/kb";

let fixture: KbTestFixture;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test("elimina scripts, handlers inline y URLs javascript de la vista", async ({
  context,
  page,
}) => {
  const suffix = uniqueToken();
  const mesa = await fixture.createMesa();
  const admin = await fixture.createUser("admin", mesa);
  const title = `Sanitización ${suffix}`;
  const article = await fixture.createArticle({
    mesa,
    authorUserId: admin.userId,
    title,
    content: [
      `# Encabezado ${suffix}`,
      "<script>alert(1)</script>",
      '<img src="x" onerror="alert(2)">',
      '<a href="javascript:alert(3)" onclick="alert(4)">Enlace peligroso</a>',
      "Texto seguro.",
    ].join("\n\n"),
  });

  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await setSessionCookie(context, admin.signedSessionId);
  const response = await page.goto(`/base-conocimiento/${article.id}`);
  expect(response?.status()).toBe(200);

  const body = page.locator(".kb-article-body");
  await expect(body).toBeVisible();
  await expect(
    body.getByRole("heading", { name: `Encabezado ${suffix}` }),
  ).toBeVisible();
  await expect(body.locator("script")).toHaveCount(0);
  await expect(
    body.locator("[onerror], [onclick], [onload], [onmouseover]"),
  ).toHaveCount(0);
  await expect(
    body.locator('[href*="javascript:"], [src*="javascript:"]'),
  ).toHaveCount(0);

  const inlineHandlerAttributes = await body.evaluate((element) =>
    [...element.querySelectorAll("*")].flatMap((node) =>
      [...node.attributes]
        .filter((attribute) => attribute.name.toLowerCase().startsWith("on"))
        .map((attribute) => `${node.nodeName}:${attribute.name}`),
    ),
  );
  expect(inlineHandlerAttributes).toEqual([]);
  expect(dialogs).toEqual([]);
});

test("sanitiza el markdown abierto en la vista previa del editor", async ({
  context,
  page,
}) => {
  const mesa = await fixture.createMesa();
  const admin = await fixture.createUser("admin", mesa);
  const suffix = uniqueToken();
  const article = await fixture.createArticle({
    mesa,
    authorUserId: admin.userId,
    title: `Vista previa ${suffix}`,
    content: "Contenido inicial.",
  });
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await setSessionCookie(context, admin.signedSessionId);
  await page.goto(`/base-conocimiento/edit/${article.id}`);
  await expect(page.locator("#kb-article-form")).toBeVisible();
  await setEasyMdeContent(
    page,
    [
      '<img src="x" onerror="alert(1)">',
      '<a href="javascript:alert(2)" onclick="alert(3)">Enlace peligroso</a>',
      "<script>alert(4)</script>",
    ].join("\n\n"),
  );

  await page
    .locator(".EasyMDEContainer .editor-toolbar button.preview")
    .click();
  const preview = page.locator(".EasyMDEContainer .editor-preview-full");
  await expect(preview).toBeVisible();
  await expect(
    preview.getByText("Enlace peligroso", { exact: true }),
  ).toBeVisible();
  await expect(preview.locator("script")).toHaveCount(0);
  await expect(
    preview.locator("[onerror], [onclick], [onload], [onmouseover]"),
  ).toHaveCount(0);
  await expect(
    preview.locator('[href*="javascript:"], [src*="javascript:"]'),
  ).toHaveCount(0);

  const inlineHandlerAttributes = await preview.evaluate((element) =>
    [...element.querySelectorAll("*")].flatMap((node) =>
      [...node.attributes]
        .filter((attribute) => attribute.name.toLowerCase().startsWith("on"))
        .map((attribute) => `${node.nodeName}:${attribute.name}`),
    ),
  );
  expect(inlineHandlerAttributes).toEqual([]);
  expect(dialogs).toEqual([]);
});
