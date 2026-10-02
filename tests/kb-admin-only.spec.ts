import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { setSessionCookie, type TestUser } from "./helpers/auth";
import { KbTestFixture, type KbTestMesa } from "./helpers/kb";

const NON_ADMIN_ROLES = [
  "agent",
  "referent",
  "team_leader",
  "supervisor",
] as const;

const navLinks = (page: Page) =>
  page.locator(
    "nav a[href='/base-conocimiento'], aside a[href='/base-conocimiento']",
  );

let fixture: KbTestFixture;
let mesa: KbTestMesa;
let admin: TestUser;

test.beforeEach(async () => {
  fixture = new KbTestFixture();
  mesa = await fixture.createMesa();
  admin = await fixture.createUser("admin", mesa);
});

test.afterEach(async () => {
  await fixture.cleanup();
});

test.describe("Base de conocimiento - visibilidad admin-only", () => {
  for (const role of NON_ADMIN_ROLES) {
    test(`un ${role} no ve el enlace a la base de conocimiento`, async ({
      context,
      page,
    }) => {
      const user = await fixture.createUser(role, mesa);
      await setSessionCookie(context, user.signedSessionId);

      await page.goto("/");
      await expect(navLinks(page)).toHaveCount(0);
    });
  }

  test("un admin ve el enlace a la base de conocimiento", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);

    await page.goto("/");
    await expect(navLinks(page).first()).toBeVisible();
  });
});
