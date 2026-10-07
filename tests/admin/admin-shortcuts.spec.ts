import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import { users, sessions } from "../../src/db/schema";
import { createHmac } from "crypto";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

test.describe("Atajos del Panel de Administración", () => {
  let adminCookie: string;
  let adminUserId: number;
  let adminSessionId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    adminSessionId = `admin-shortcut-${ts}`;
    const [u] = await db
      .insert(users)
      .values({
        username: `admin_ui_${ts}`,
        password: "hash",
        role: "admin",
      })
      .returning({ id: users.id });
    adminUserId = u.id;
    await db.insert(sessions).values({
      id: adminSessionId,
      userId: adminUserId,
      expiresAt: Date.now() + 86400000,
    });
    adminCookie = sign(adminSessionId);
  });

  test("Los atajos se renderizan con contenedores de color y variantes filled", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: "session_id",
        value: adminCookie,
        domain: "localhost",
        path: "/",
      },
      {
        name: "mda_session",
        value: adminCookie,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText("Administración");

    const links = [
      "Usuarios",
      "Sugerencias y Reportes",
      "Auditoría",
      "Papelera",
      "Recursos",
      "Aplicativos",
      "Contactos",
      "Ubicaciones InvGate",
    ];
    for (const title of links) {
      await expect(page.locator(`a[aria-label="Ir a ${title}"]`)).toBeVisible();
    }
  });
});
