import "dotenv/config";
import { expect, test } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie } from "../helpers/auth";

test.describe("cronograma — copiado de imágenes al portapapeles", () => {
  let userId: number;
  let sessionId: string;

  test.beforeEach(async ({ context }) => {
    const user = await createTestUserAndSession("admin");
    userId = user.userId;
    sessionId = user.sessionId;
    await setSessionCookie(context, user.signedSessionId);
    const base = test.info().project.use.baseURL ?? "http://localhost:4321";
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(base).origin });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(base.replace("localhost", "127.0.0.1")).origin });
  });

  test.afterEach(async () => {
    await cleanupTestUser(userId, sessionId);
  });

  test("copiar tabla de rotación de sábados genera una imagen no en blanco con la card completa", async ({ page }) => {
    await page.goto("/supervision/cronograma");
    await page.waitForSelector("#monthly-table");
    await page.click("#switch-to-groups-btn");
    await page.waitForSelector("#saturday-rotation-card");

    await page.click("#copy-rotation-image-btn");
    await expect(page.locator("#copy-rotation-image-btn")).toHaveClass(/btn-success/, { timeout: 10000 });

    const result = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      let imgBlob: Blob | null = null;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            imgBlob = await item.getType(type);
            break;
          }
        }
        if (imgBlob) break;
      }
      if (!imgBlob) return { error: "No image in clipboard" };

      const bmp = await createImageBitmap(imgBlob);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height).data;

      let nonBgPixels = 0;
      const bgR = imgData[0];
      const bgG = imgData[1];
      const bgB = imgData[2];

      for (let i = 0; i < imgData.length; i += 16) {
        const dr = Math.abs(imgData[i] - bgR);
        const dg = Math.abs(imgData[i + 1] - bgG);
        const db = Math.abs(imgData[i + 2] - bgB);
        if (dr > 15 || dg > 15 || db > 15) {
          nonBgPixels++;
        }
      }
      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const headerBytes = Array.from(new Uint8Array(await imgBlob.slice(0, 8).arrayBuffer()));
      const pngSignatureValid = pngSignature.every((b, i) => b === headerBytes[i]);

      return {
        width: bmp.width,
        height: bmp.height,
        size: imgBlob.size,
        nonBgPixels,
        pngSignatureValid,
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.pngSignatureValid).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.nonBgPixels).toBeGreaterThan(1000);
  });

  test("copiar horas extras copia la lista compacta de turnos guardados y no genera imagen en blanco", async ({ page }) => {
    await page.goto("/supervision/cronograma");
    await page.waitForSelector("#monthly-table");
    await page.click("#switch-to-overtime-btn");
    await page.waitForSelector("#overtime-shifts-list");

    await page.click("#copy-overtime-image-btn");
    await expect(page.locator("#copy-overtime-image-btn")).toHaveClass(/btn-success/, { timeout: 10000 });

    const result = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      let imgBlob: Blob | null = null;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            imgBlob = await item.getType(type);
            break;
          }
        }
        if (imgBlob) break;
      }
      if (!imgBlob) return { error: "No image in clipboard" };

      const bmp = await createImageBitmap(imgBlob);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height).data;

      let nonBgPixels = 0;
      const bgR = imgData[0];
      const bgG = imgData[1];
      const bgB = imgData[2];

      for (let i = 0; i < imgData.length; i += 16) {
        const dr = Math.abs(imgData[i] - bgR);
        const dg = Math.abs(imgData[i + 1] - bgG);
        const db = Math.abs(imgData[i + 2] - bgB);
        if (dr > 15 || dg > 15 || db > 15) {
          nonBgPixels++;
        }
      }

      const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const headerBytes = Array.from(new Uint8Array(await imgBlob.slice(0, 8).arrayBuffer()));
      const pngSignatureValid = pngSignature.every((b, i) => b === headerBytes[i]);

      return {
        width: bmp.width,
        height: bmp.height,
        size: imgBlob.size,
        nonBgPixels,
        pngSignatureValid,
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.pngSignatureValid).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.nonBgPixels).toBeGreaterThan(500);
  });
});
