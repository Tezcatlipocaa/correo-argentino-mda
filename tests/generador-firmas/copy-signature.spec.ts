import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "../helpers/auth";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function readClipboard(
  page: Page,
): Promise<{ html: string | null; types: string[] }> {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const types = items.flatMap((item) => Array.from(item.types));
    let html: string | null = null;
    for (const item of items) {
      if (item.types.includes("text/html")) {
        html = await (await item.getType("text/html")).text();
      }
    }
    return { html, types };
  });
}

test.describe("generador de firmas — copiar firma visual", () => {
  let userId = 0;
  let sessionId = "";

  test.beforeEach(async ({ context, baseURL }) => {
    const user = await createTestUserAndSession("agent");
    userId = user.userId;
    sessionId = user.sessionId;
    await setSessionCookie(context, user.signedSessionId);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseURL ?? "http://localhost:4321").origin,
    });
  });

  test.afterEach(async () => {
    if (userId && sessionId) {
      await cleanupTestUser(userId, sessionId);
    }
  });

  test("sirve el logo institucional en una ruta estable /firma.png", async ({ page }) => {
    const res = await page.request.get("/firma.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    expect((await res.body()).subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });

  test("el HTML copiado referencia el logo por URL absoluta y estable", async ({ page }) => {
    await page.goto("/generador-firmas");
    await page.fill("#input-name", "Juan Perez");
    await page.fill("#input-role", "Operador N1");
    await page.fill("#input-department", "Mesa de Ayuda");
    await page.fill("#input-address1", "Av. Paseo Colon 740");
    await page.click("#btn-copy-visual");

    await expect
      .poll(async () => (await readClipboard(page)).html, { timeout: 5000 })
      .not.toBeNull();

    const clipboard = await readClipboard(page);
    expect(clipboard.html).toContain("<table");
    expect(clipboard.types).toContain("text/plain");

    const match = clipboard.html!.match(/<img[^>]+src="([^"]+)"/);
    expect(match).not.toBeNull();
    const logoUrl = new URL(match![1]);
    expect(logoUrl.origin).toBe(new URL(page.url()).origin);
    expect(logoUrl.pathname).toBe("/firma.png");

    const logo = await page.request.get(logoUrl.href);
    expect(logo.status()).toBe(200);
    expect(logo.headers()["content-type"]).toContain("image/png");
  });
});
