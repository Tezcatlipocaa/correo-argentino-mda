import "dotenv/config";
import { expect, test } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie } from "../helpers/auth";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test.describe("cronograma — export PNG server-side", () => {
  let userId: number;
  let sessionId: string;

  test.beforeEach(async ({ context }) => {
    const user = await createTestUserAndSession("admin");
    userId = user.userId;
    sessionId = user.sessionId;
    await setSessionCookie(context, user.signedSessionId);
  });

  test.afterEach(async () => {
    await cleanupTestUser(userId, sessionId);
  });

  test("el endpoint devuelve un PNG válido para un mes con formato correcto", async ({ page }) => {
    const res = await page.request.get("/api/cronograma/export.png?month=2026-09");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    const body = await res.body();
    expect(body.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(body.readUInt32BE(16)).toBe(2904);
    expect(body.readUInt32BE(20)).toBeGreaterThan(0);
  });

  test("rechaza un mes inválido con 400", async ({ page }) => {
    const res = await page.request.get("/api/cronograma/export.png?month=2026-13");
    expect(res.status()).toBe(400);
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("sin sesión no devuelve la imagen", async ({ request }) => {
    const res = await request.get("/api/cronograma/export.png?month=2026-09");
    expect([302, 401]).toContain(res.status());
  });

  test("el botón Exportar Imagen (PNG) descarga un archivo PNG", async ({ page }) => {
    await page.goto("/supervision/cronograma");
    await page.waitForSelector("#monthly-table");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#export-image-btn");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cronograma.*\.png$/);
    const filePath = await download.path();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(filePath);
    expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });

  test("copiar la tabla de guardia no muta el card visible durante la captura", async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:4321" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4321" });
    await page.goto("/supervision/cronograma");
    await page.waitForSelector("#monthly-table");
    await page.click("#switch-to-groups-btn");
    await page.waitForSelector("#saturday-rotation-card");
    await page.evaluate(() => {
      const card = document.getElementById("saturday-rotation-card");
      (window as unknown as { __cardClassChanges: string[] }).__cardClassChanges = [];
      if (!card) return;
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "class") {
            (window as unknown as { __cardClassChanges: string[] }).__cardClassChanges.push(`${m.oldValue ?? ""}=>${card.getAttribute("class") ?? ""}`);
          }
        }
      }).observe(card, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
    });
    await page.click("#copy-rotation-image-btn");
    await expect(page.locator("#copy-rotation-image-btn")).toHaveClass(/btn-success/, { timeout: 5000 });
    await page.waitForTimeout(1500);
    const changes = await page.evaluate(() => (window as unknown as { __cardClassChanges: string[] }).__cardClassChanges);
    expect(changes.some((c) => c.includes("exporting-image"))).toBe(false);
    await expect(page.locator("#copy-rotation-image-btn")).toBeVisible();
  });
});
