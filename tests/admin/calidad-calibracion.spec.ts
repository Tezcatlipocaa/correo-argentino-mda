import "dotenv/config";
import { expect, test } from "@playwright/test";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie, type TestUser } from "../helpers/auth";

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin", { helpdeskName: "TI_GSM_MDA TI" });
});

test.afterAll(async () => {
  await cleanupTestUser(admin.userId, admin.sessionId);
});

test("la página de calibración compila y renderiza para un usuario administrador (#370)", async ({
  page,
  context,
}) => {
  await setSessionCookie(context, admin.signedSessionId);

  const response = await page.goto("/admin/calidad/calibracion");
  expect(response?.status()).toBe(200);

  // Verifica que la página y el componente server island compilen y rendericen sin PARSE_ERROR
  await expect(page.getByRole("heading", { name: "Calibración de Calidad IA (Ground Truth)" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Volver a Calidad de Operadores")).toBeVisible();
});
