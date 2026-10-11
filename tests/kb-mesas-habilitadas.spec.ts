import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles, mesas } from "../src/db/schema";
import { MDA_TI_HELPDESK } from "../src/lib/helpdeskAccess";
import { setSessionCookie, signSessionId, type TestUser } from "./helpers/auth";
import { KbTestFixture, setEasyMdeContent, uniqueToken } from "./helpers/kb";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const KB_IMAGE_MARKER = "/api/kb/images/";

const deleteKbImage = (url: string): void => {
  const markerIndex = url.indexOf(KB_IMAGE_MARKER);
  if (markerIndex < 0) return;
  const relative = url
    .slice(markerIndex + KB_IMAGE_MARKER.length)
    .split(/[?#]/)[0];
  const storageRoot = path.resolve(
    process.env.EXTERNAL_STORAGE_DIR || "./data/storage",
  );
  const imagesRoot = path.join(storageRoot, "kb-images");
  const filePath = path.resolve(imagesRoot, relative);
  if (
    filePath.startsWith(`${imagesRoot}${path.sep}`) &&
    fs.existsSync(filePath)
  ) {
    fs.unlinkSync(filePath);
  }
};

let fixture: KbTestFixture;
let adminUser: TestUser;
let mesaHabilitadaId = 0;
let mesaDeshabilitadaId = 0;
let mesaDeshabilitadaNombre = "";
let mesaInactivaId = 0;
let mesaInactivaNombre = "";
let mdaTiInvgateId = 0;
let mdaTiAssignableOriginal: boolean | null = null;

const submitArticle = async (
  page: Page,
  helpdeskId: number,
  title: string,
): Promise<void> => {
  await page.locator("#kb-title").fill(title);
  await page.locator("#kb-helpdesk").evaluate((element) => {
    (element as HTMLSelectElement).disabled = true;
  });
  await page.locator("#kb-article-form").evaluate((form, value) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "helpdeskId";
    input.value = String(value);
    form.appendChild(input);
  }, helpdeskId);
  await setEasyMdeContent(page, `Contenido E2E ${uniqueToken()}`);
  await page.getByRole("button", { name: "Crear artículo" }).click();
};

test.beforeAll(async () => {
  fixture = new KbTestFixture();
  const adminMesa = await fixture.createMesa();
  const mesaHabilitada = await fixture.createMesa();
  const mesaDeshabilitada = await fixture.createMesa();
  const mesaInactiva = await fixture.createMesa();

  mesaHabilitadaId = mesaHabilitada.invgateId;
  mesaDeshabilitadaId = mesaDeshabilitada.invgateId;
  mesaDeshabilitadaNombre = mesaDeshabilitada.name;
  mesaInactivaId = mesaInactiva.invgateId;
  mesaInactivaNombre = mesaInactiva.name;

  adminUser = await fixture.createUser("admin", adminMesa);

  await db
    .update(mesas)
    .set({ assignable: false })
    .where(eq(mesas.invgateId, mesaDeshabilitada.invgateId));

  await db
    .update(mesas)
    .set({ active: false })
    .where(eq(mesas.invgateId, mesaInactiva.invgateId));

  const [mdaTi] = await db
    .select({ invgateId: mesas.invgateId, assignable: mesas.assignable })
    .from(mesas)
    .where(eq(mesas.name, MDA_TI_HELPDESK))
    .limit(1);

  if (!mdaTi) {
    throw new Error(`La mesa ${MDA_TI_HELPDESK} no existe en la base de datos`);
  }
  mdaTiInvgateId = mdaTi.invgateId;
  mdaTiAssignableOriginal = mdaTi.assignable;
  await db
    .update(mesas)
    .set({ assignable: false })
    .where(eq(mesas.invgateId, mdaTi.invgateId));
});

test.afterAll(async () => {
  try {
    if (mdaTiInvgateId > 0 && mdaTiAssignableOriginal !== null) {
      await db
        .update(mesas)
        .set({ assignable: mdaTiAssignableOriginal })
        .where(eq(mesas.invgateId, mdaTiInvgateId));
      const [restored] = await db
        .select({ assignable: mesas.assignable })
        .from(mesas)
        .where(eq(mesas.invgateId, mdaTiInvgateId))
        .limit(1);
      expect(restored?.assignable).toBe(mdaTiAssignableOriginal);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("mesa no assignable no aparece en el select de admin; las habilitadas y MDA TI sí", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  await page.goto("/base-conocimiento/create");

  const select = page.locator("#kb-helpdesk");
  await expect(select).toBeVisible();

  await expect(
    select.locator(`option[value="${mesaDeshabilitadaId}"]`),
  ).toHaveCount(0);
  await expect(
    select.locator(`option[value="${mesaHabilitadaId}"]`),
  ).toHaveCount(1);
  await expect(
    select.locator("option").filter({ hasText: MDA_TI_HELPDESK }),
  ).toHaveCount(1);

  const labels = await select.locator("option").allInnerTexts();
  expect(labels).not.toContain(mesaDeshabilitadaNombre);
});

test("POST con mesa deshabilitada se rechaza y no crea artículo", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  await page.goto("/base-conocimiento/create");

  const title = `KB mesa deshabilitada ${uniqueToken()}`;
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/base-conocimiento/create",
  );
  await submitArticle(page, mesaDeshabilitadaId, title);
  const response = await responsePromise;
  expect(response.status()).toBe(200);

  await expect(page).toHaveURL(/\/base-conocimiento\/create$/);
  await expect(page.locator("#global-toast-container")).toContainText(
    "La mesa indicada no existe o está inactiva.",
  );

  const rows = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.helpdeskId, mesaDeshabilitadaId),
        eq(kbArticles.title, title),
      ),
    );
  expect(rows).toEqual([]);
});

test("upload a mesa activa no assignable se permite (escenario edición)", async ({
  context,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);

  const response = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
      helpdeskId: String(mesaDeshabilitadaId),
    },
    headers: { cookie: `session_id=${signSessionId(adminUser.sessionId)}` },
  });

  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("El upload no devolvió una URL");
  expect(payload.url).toContain(`/api/kb/images/${mesaDeshabilitadaId}/`);
  fixture.trackImageUrl(payload.url, mesaDeshabilitadaId);
});

test("mesa assignable pero inactiva se oculta y se rechaza en POST y upload", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  await page.goto("/base-conocimiento/create");

  const select = page.locator("#kb-helpdesk");
  await expect(select).toBeVisible();
  await expect(select.locator(`option[value="${mesaInactivaId}"]`)).toHaveCount(
    0,
  );
  const labels = await select.locator("option").allInnerTexts();
  expect(labels).not.toContain(mesaInactivaNombre);

  const title = `KB mesa inactiva ${uniqueToken()}`;
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/base-conocimiento/create",
  );
  await submitArticle(page, mesaInactivaId, title);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(/\/base-conocimiento\/create$/);
  await expect(page.locator("#global-toast-container")).toContainText(
    "La mesa indicada no existe o está inactiva.",
  );

  const rows = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.helpdeskId, mesaInactivaId),
        eq(kbArticles.title, title),
      ),
    );
  expect(rows).toEqual([]);

  const uploadResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
      helpdeskId: String(mesaInactivaId),
    },
    headers: { cookie: `session_id=${signSessionId(adminUser.sessionId)}` },
  });
  const uploadBody = (await uploadResponse.json()) as { error?: string };
  expect(uploadResponse.status()).toBe(400);
  expect(uploadBody.error).toBe("La mesa indicada no existe o está inactiva.");
});

test("upload a mesa inexistente devuelve 400 con mensaje de mesa", async ({
  context,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);

  const response = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
      helpdeskId: "2147483000",
    },
    headers: { cookie: `session_id=${signSessionId(adminUser.sessionId)}` },
  });
  const body = (await response.json()) as { error?: string };
  expect(response.status()).toBe(400);
  expect(body.error).toBe("La mesa indicada no existe o está inactiva.");
});

test("upload a MDA TI se permite aunque su assignable sea false", async ({
  context,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);

  const response = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
      helpdeskId: String(mdaTiInvgateId),
    },
    headers: { cookie: `session_id=${signSessionId(adminUser.sessionId)}` },
  });
  const status = response.status();
  const payload = (await response.json()) as { url?: string };

  try {
    expect(status).toBe(200);
    if (!payload.url) throw new Error("El upload no devolvió una URL");
    expect(payload.url).toContain(`/api/kb/images/${mdaTiInvgateId}/`);
  } finally {
    if (payload.url) deleteKbImage(payload.url);
  }
});

test("mesa assignable sigue funcionando: crea artículo y sube imagen", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  await page.goto("/base-conocimiento/create");

  const title = `KB mesa habilitada ${uniqueToken()}`;
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/base-conocimiento/create",
  );
  await submitArticle(page, mesaHabilitadaId, title);
  const response = await responsePromise;
  expect([200, 302]).toContain(response.status());
  await expect(page).toHaveURL(/\/base-conocimiento(?:\?.*)?$/);

  const [article] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.helpdeskId, mesaHabilitadaId),
        eq(kbArticles.title, title),
      ),
    )
    .limit(1);
  expect(article).toBeDefined();
  if (!article) throw new Error("No se creó el artículo en la mesa habilitada");
  fixture.trackArticle(article.id);

  const uploadResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
      helpdeskId: String(mesaHabilitadaId),
    },
    headers: { cookie: `session_id=${signSessionId(adminUser.sessionId)}` },
  });
  expect(uploadResponse.status()).toBe(200);
  const payload = (await uploadResponse.json()) as { url?: string };
  if (!payload.url) throw new Error("El upload no devolvió una URL");
  fixture.trackImageUrl(payload.url, mesaHabilitadaId);
});

test("MDA TI con assignable=false sigue ofrecida y aceptada", async ({
  context,
  page,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  await page.goto("/base-conocimiento/create");

  await expect(
    page.locator("#kb-helpdesk option").filter({ hasText: MDA_TI_HELPDESK }),
  ).toHaveCount(1);

  const title = `KB MDA TI ${uniqueToken()}`;
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/base-conocimiento/create",
  );
  await submitArticle(page, mdaTiInvgateId, title);
  const response = await responsePromise;
  expect([200, 302]).toContain(response.status());
  await expect(page).toHaveURL(/\/base-conocimiento(?:\?.*)?$/);

  const [article] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.helpdeskId, mdaTiInvgateId),
        eq(kbArticles.title, title),
      ),
    )
    .limit(1);
  expect(article).toBeDefined();
  if (!article) throw new Error("No se creó el artículo en MDA TI");
  fixture.trackArticle(article.id);
});
