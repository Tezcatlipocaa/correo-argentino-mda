import "dotenv/config";
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { kbArticles } from "../src/db/schema";
import { setSessionCookie } from "./helpers/auth";
import {
  expectKbDenied,
  KbTestFixture,
  setEasyMdeContent,
  uniqueToken,
} from "./helpers/kb";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createPngWithExactSize = (size: number) => {
  if (size < PNG_1X1.length) {
    throw new Error(`PNG size ${size} is smaller than the base fixture`);
  }

  const iendOffset = PNG_1X1.length - 12;
  const textChunkSize = size - iendOffset - 12;
  const textDataLength = textChunkSize - 12;
  if (textDataLength < 2) {
    throw new Error(`PNG size ${size} cannot fit an ancillary text chunk`);
  }

  const textChunk = Buffer.alloc(textChunkSize);
  textChunk.writeUInt32BE(textDataLength, 0);
  textChunk.write("tEXt", 4, 4, "ascii");
  textChunk.write("C", 8, 1, "ascii");
  textChunk.writeUInt8(0, 9);
  textChunk.fill(0x78, 10, 8 + textDataLength);
  const crcInput = textChunk.subarray(4, 8 + textDataLength);
  textChunk.writeUInt32BE(crc32(crcInput), 8 + textDataLength);

  return Buffer.concat([
    PNG_1X1.subarray(0, iendOffset),
    textChunk,
    PNG_1X1.subarray(iendOffset),
  ]);
};

let fixture: KbTestFixture;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test("sirve imágenes válidas y respeta límites y scope", async ({
  context,
}) => {
  const uploadMesa = await fixture.createMesa();
  const otherMesa = await fixture.createMesa();
  const uploader = await fixture.createUser("admin", uploadMesa);
  const sameMesaAgent = await fixture.createUser("agent", uploadMesa);
  const otherMesaAgent = await fixture.createUser("agent", otherMesa);
  const otherMesaAdmin = await fixture.createUser("admin", otherMesa);

  await setSessionCookie(context, uploader.signedSessionId);
  const uploadResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      },
    },
  });
  const payload = (await uploadResponse.json()) as { url?: string };

  expect(uploadResponse.status()).toBe(200);
  if (!payload.url) throw new Error("Upload response did not include a URL");
  expect(payload.url).toMatch(
    new RegExp(
      `^/api/kb/images/${uploadMesa.invgateId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`,
      "i",
    ),
  );
  fixture.trackImageUrl(payload.url, uploadMesa.invgateId);

  await context.clearCookies();
  await setSessionCookie(context, sameMesaAgent.signedSessionId);
  const sameMesaResponse = await context.request.get(payload.url, {
    maxRedirects: 0,
  });
  expectKbDenied(sameMesaResponse);

  await context.clearCookies();
  await setSessionCookie(context, otherMesaAdmin.signedSessionId);
  const adminCrossMesaResponse = await context.request.get(payload.url);
  expect(adminCrossMesaResponse.status()).toBe(200);
  expect(adminCrossMesaResponse.headers()["content-type"]).toBe("image/png");
  expect(
    Buffer.from(await adminCrossMesaResponse.body()).subarray(
      0,
      PNG_MAGIC.length,
    ),
  ).toEqual(PNG_MAGIC);

  await context.clearCookies();
  await setSessionCookie(context, otherMesaAgent.signedSessionId);
  const agentCrossMesaResponse = await context.request.get(payload.url, {
    maxRedirects: 0,
  });
  expectKbDenied(agentCrossMesaResponse);

  await context.clearCookies();
  await setSessionCookie(context, uploader.signedSessionId);
  const invalidImageResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("esto no es una imagen"),
      },
    },
  });
  expect(invalidImageResponse.status()).toBe(400);

  const exactLimitPng = createPngWithExactSize(2 * 1024 * 1024);
  expect(exactLimitPng.subarray(0, PNG_MAGIC.length)).toEqual(PNG_MAGIC);
  const exactLimitResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "exact-limit.png",
        mimeType: "image/png",
        buffer: exactLimitPng,
      },
    },
  });
  const exactLimitPayload = (await exactLimitResponse.json()) as {
    url?: string;
  };
  expect(exactLimitResponse.status()).toBe(200);
  if (!exactLimitPayload.url) {
    throw new Error("Exact-limit upload did not return a URL");
  }
  fixture.trackImageUrl(exactLimitPayload.url, uploadMesa.invgateId);

  const oversizedPng = createPngWithExactSize(2 * 1024 * 1024 + 1);
  expect(oversizedPng.subarray(0, PNG_MAGIC.length)).toEqual(PNG_MAGIC);
  const oversizedResponse = await context.request.post("/api/kb/upload", {
    multipart: {
      file: {
        name: "oversized.png",
        mimeType: "image/png",
        buffer: oversizedPng,
      },
      padding: "x".repeat(128 * 1024),
    },
  });
  expect(oversizedResponse.status()).toBe(413);
});

test("sube una imagen desde EasyMDE y la renderiza al guardar", async ({
  context,
  page,
}) => {
  const mesa = await fixture.createMesa();
  const admin = await fixture.createUser("admin", mesa);
  const suffix = uniqueToken();
  const title = `Imagen desde editor ${suffix}`;

  await setSessionCookie(context, admin.signedSessionId);
  await page.goto("/base-conocimiento/create");
  await expect(page.locator("#kb-article-form")).toBeVisible();
  await page.locator("#kb-title").fill(title);
  await setEasyMdeContent(page, "Imagen de prueba\n\n");

  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/kb/upload"),
  );
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .locator(".EasyMDEContainer .editor-toolbar button.upload-image")
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "editor-pixel.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });

  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(200);
  const payload = (await uploadResponse.json()) as { url?: string };
  if (!payload.url) throw new Error("Editor upload did not return a URL");
  const imageUrl = payload.url;
  fixture.trackImageUrl(imageUrl, mesa.invgateId);

  const source = page.locator('textarea[name="content"]');
  await expect.poll(() => source.inputValue()).toContain(imageUrl);

  const submitResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/base-conocimiento/create"),
  );
  await page.getByRole("button", { name: "Crear artículo" }).click();
  const submitResponse = await submitResponsePromise;
  expect([200, 302]).toContain(submitResponse.status());
  await expect(page).toHaveURL(/\/base-conocimiento(?:\?.*)?$/);

  const [article] = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.helpdeskId, mesa.invgateId),
        eq(kbArticles.authorUserId, admin.userId),
        eq(kbArticles.title, title),
      ),
    )
    .limit(1);
  expect(article).toBeDefined();
  if (!article) throw new Error("Editor-created article was not found");
  fixture.trackArticle(article.id);

  const imageResponsePromise = page.waitForResponse(
    (response) =>
      response.request().resourceType() === "image" &&
      response.url().endsWith(imageUrl),
  );
  await page.goto(`/base-conocimiento/${article.id}`);
  const imageResponse = await imageResponsePromise;
  expect(imageResponse.status()).toBe(200);

  const image = page.locator(".kb-article-body img");
  await expect(image).toHaveAttribute("src", imageUrl);
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});
