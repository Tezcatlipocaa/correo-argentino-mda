import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import {
  users,
  sessions,
  applications,
  applicationCategories,
} from "../../src/db/schema";
import { eq } from "drizzle-orm";

import { createHmac, createDecipheriv, createHash } from "crypto";

function decryptMetadata(encryptedText: string): string {
  const key = createHash("sha256")
    .update(process.env.ENCRYPTION_KEY as string)
    .digest();
  const [ivHex, tagHex, encryptedHex] = encryptedText.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
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

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function signSessionId(sessionId: string): string {
  const signature = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

const rawSessionId = `test-admin-session-${Date.now()}`;
const MOCK_SESSION_ID = signSessionId(rawSessionId);
let testUserId: number;
let testCategoryId: number;
let testAppId: number;

test.beforeAll(async () => {
  // 1. Create a fake admin user
  const [newUser] = await db
    .insert(users)
    .values({
      username: `admin_test_e2e_${Date.now()}`,
      password: "hashed_fake_password",
      role: "admin",
    })
    .returning({ id: users.id });
  testUserId = newUser.id;

  // 2. Create a fake session
  await db.insert(sessions).values({
    id: rawSessionId,
    userId: testUserId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 1 day
  });

  // 3. Create a mock category
  const [newCat] = await db
    .insert(applicationCategories)
    .values({
      title: "Categoría de Prueba E2E",
    })
    .returning({ id: applicationCategories.id });
  testCategoryId = newCat.id;

  // 4. Create a mock application
  const [newApp] = await db
    .insert(applications)
    .values({
      title: "App Prueba E2E",
      categoryId: testCategoryId,
      description: "Descripción original",
      version: "1.0.0",
      filePath: "http://example.com/file.zip",
    })
    .returning({ id: applications.id });
  testAppId = newApp.id;
});

test.beforeEach(async ({ context }) => {
  // Simular sesión inyectando cookie
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
  // Limpieza en orden inverso (Teardown)
  if (testAppId) {
    await db.delete(applications).where(eq(applications.id, testAppId));
  }
  if (testCategoryId) {
    await db
      .delete(applicationCategories)
      .where(eq(applicationCategories.id, testCategoryId));
  }
  if (rawSessionId) {
    await db.delete(sessions).where(eq(sessions.id, rawSessionId));
  }
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId));
  }
});

test.describe("Vistas de edición de aplicativos", () => {
  test("Debería renderizar los campos existentes correctamente", async ({
    page,
  }) => {
    await page.goto(`/admin/aplicativos/edit/${testAppId}`);

    // Aserciones sobre el renderizado
    await expect(
      page.getByRole("heading", { name: "Editar aplicativo" }),
    ).toBeVisible();
    await expect(page.locator('input[name="title"]')).toHaveValue(
      "App Prueba E2E",
    );
    await expect(page.locator('select[name="categoryId"]')).toHaveValue(
      String(testCategoryId),
    );
    await expect(page.locator('input[name="version"]')).toHaveValue("1.0.0");
    await expect(page.locator('textarea[name="description"]')).toHaveValue(
      "Descripción original",
    );

    // Origen de archivo: externo
    const externalRadio = page.locator(
      'input[name="uploadType"][value="external"]',
    );
    await expect(externalRadio).toBeChecked();
    await expect(page.locator('input[name="externalUrl"]')).toHaveValue(
      "http://example.com/file.zip",
    );
  });

  test("Debería actualizar los valores y redirigir al listado", async ({
    page,
  }) => {
    await page.goto(`/admin/aplicativos/edit/${testAppId}`);

    // Inyección de nuevos valores
    await page.fill('input[name="title"]', "App Prueba E2E Modificada");
    await page.fill('input[name="version"]', "1.1.0");
    await page.fill(
      'textarea[name="description"]',
      "Nueva descripción modificada",
    );

    // Enviar el formulario
    await page.click('button[type="submit"]');

    // Validar la redirección (esperando a que la URL cambie al listado de aplicativos)
    await page.waitForURL("**/admin/aplicativos");

    // Validar en la BD que se actualizó el registro
    const [updatedApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, testAppId));
    expect(updatedApp.title).toBe("App Prueba E2E Modificada");
    expect(updatedApp.version).toBe("1.1.0");
    expect(updatedApp.description).toBe("Nueva descripción modificada");
  });

  test("Debería persistir las credenciales (metadata) editadas", async ({
    page,
  }) => {
    await page.goto(`/admin/aplicativos/edit/${testAppId}`);

    await page.click("#btn-add-meta");
    const rows = page.locator(".app-meta-row");
    await expect(rows).toHaveCount(1);
    await rows.nth(0).locator("input").nth(0).fill("Buscador");
    await rows.nth(0).locator("input").nth(1).fill("super-secreta-123");

    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/aplicativos");

    const [updatedApp] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, testAppId));
    expect(updatedApp.metadata).toBeTruthy();
    const parsed = JSON.parse(
      decryptMetadata(updatedApp.metadata as string),
    );
    expect(parsed).toEqual([
      { label: "Buscador", value: "super-secreta-123" },
    ]);
  });
});
