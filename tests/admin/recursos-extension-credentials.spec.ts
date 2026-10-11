import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import {
  users,
  sessions,
  resourceCategories,
  resourceLinks,
  applications,
} from "../../src/db/schema";
import { eq } from "drizzle-orm";
import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function signSessionId(sessionId: string): string {
  const signature = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

function aesKey(): Buffer {
  return createHash("sha256")
    .update(process.env.ENCRYPTION_KEY as string)
    .digest();
}

function encryptMetadata(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted}`;
}

function decryptMetadata(encryptedText: string): string {
  const [ivHex, tagHex, encryptedHex] = encryptedText.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    aesKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(
    Buffer.from(encryptedHex, "hex"),
    undefined,
    "utf8",
  );
  decrypted += decipher.final("utf8");
  return decrypted;
}

const rawSessionId = `test-admin-session-enlaces-${Date.now()}`;
const MOCK_SESSION_ID = signSessionId(rawSessionId);
let testUserId: number;
let categoryId: number;
let linkId: number;
let appId: number | null = null;
let appCreated = false;
let originalAppMetadata: string | null = null;

const MDA_FIND_TITLE = "Extensión MDA FIND";
const TEST_PASSWORD = "s3cret-pwd";
const TEST_TOKEN = "tok-abc-123";

test.beforeAll(async () => {
  const [newUser] = await db
    .insert(users)
    .values({
      username: `admin_test_enlaces_${Date.now()}`,
      password: "hashed_fake_password",
      role: "admin",
    })
    .returning({ id: users.id });
  testUserId = newUser.id;

  await db.insert(sessions).values({
    id: rawSessionId,
    userId: testUserId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });

  const [cat] = await db
    .insert(resourceCategories)
    .values({ title: "Cat Enlaces E2E", iconName: "boxicons:link" })
    .returning({ id: resourceCategories.id });
  categoryId = cat.id;

  const [link] = await db
    .insert(resourceLinks)
    .values({
      categoryId,
      title: "Enlace E2E",
      url: "https://example.com/e2e",
      credentialUsername: "usuario-e2e",
      credentialPassword: encryptMetadata(TEST_PASSWORD),
    })
    .returning({ id: resourceLinks.id });
  linkId = link.id;

  const existingApp = await db.query.applications.findFirst({
    where: eq(applications.title, MDA_FIND_TITLE),
  });
  if (existingApp) {
    appId = existingApp.id;
    originalAppMetadata = existingApp.metadata;
  } else {
    const [newApp] = await db
      .insert(applications)
      .values({ title: MDA_FIND_TITLE })
      .returning({ id: applications.id });
    appId = newApp.id;
    appCreated = true;
  }

  await db
    .update(applications)
    .set({
      metadata: encryptMetadata(
        JSON.stringify([{ label: "Token", value: TEST_TOKEN }]),
      ),
    })
    .where(eq(applications.id, appId));
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "session_id",
      value: MOCK_SESSION_ID,
      domain: "localhost",
      path: "/",
    },
  ]);
});

test.afterAll(async () => {
  if (appId !== null) {
    if (appCreated) {
      await db.delete(applications).where(eq(applications.id, appId));
    } else {
      await db
        .update(applications)
        .set({ metadata: originalAppMetadata })
        .where(eq(applications.id, appId));
    }
  }
  if (linkId) await db.delete(resourceLinks).where(eq(resourceLinks.id, linkId));
  if (categoryId)
    await db
      .delete(resourceCategories)
      .where(eq(resourceCategories.id, categoryId));
  if (rawSessionId)
    await db.delete(sessions).where(eq(sessions.id, rawSessionId));
  if (testUserId) await db.delete(users).where(eq(users.id, testUserId));
});

test.describe("Credenciales editables desde el portal", () => {
  test("El form de enlace muestra la contraseña actual y permite revelarla", async ({
    page,
  }) => {
    await page.goto(`/admin/recursos/enlace/edit/${linkId}`);

    const pwd = page.locator('input[name="credentialPassword"]');
    await expect(pwd).toHaveValue(TEST_PASSWORD);
    await expect(pwd).toHaveAttribute("type", "password");

    await expect(page.locator('input[name="credentialUsername"]')).toHaveValue(
      "usuario-e2e",
    );

    await page
      .locator('input[name="credentialPassword"] ~ button[data-toggle-password]')
      .click();
    await expect(pwd).toHaveAttribute("type", "text");
  });

  test("Guardar sin cambios conserva la contraseña del enlace", async ({
    page,
  }) => {
    await page.goto(`/admin/recursos/enlace/edit/${linkId}`);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/recursos");

    const [updated] = await db
      .select()
      .from(resourceLinks)
      .where(eq(resourceLinks.id, linkId));
    expect(decryptMetadata(updated.credentialPassword as string)).toBe(
      TEST_PASSWORD,
    );
  });

  test("La card de la extensión en buscador-usuarios refleja la credencial del aplicativo", async ({
    page,
  }) => {
    await page.goto(`/buscador-usuarios`);

    const token = page.locator('input[data-password-input][value]').first();
    await expect(page.getByText("Token", { exact: true })).toBeVisible();
    await expect(token).toHaveValue(TEST_TOKEN);
    await expect(token).toHaveAttribute("type", "password");

    await page.locator("button[data-toggle-password]").first().click();
    await expect(token).toHaveAttribute("type", "text");
  });
});
