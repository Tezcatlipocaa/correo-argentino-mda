import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

let adminUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
});

test.describe("Shell de /automatizaciones en SSR streaming", () => {
  test("la sidebar se emite antes de <main>", async ({ context, request }) => {
    await setSessionCookie(context, adminUser.signedSessionId);

    const response = await request.get("/automatizaciones");
    expect(response.status()).toBe(200);

    const html = await response.text();
    const asideIndex = html.search(/<aside[^>]*class="[^"]*drawer-side/);
    const mainIndex = html.search(/<main[\s>]/);

    expect(asideIndex, "la sidebar debe existir en el HTML").toBeGreaterThan(-1);
    expect(mainIndex, "<main> debe existir en el HTML").toBeGreaterThan(-1);
    expect(
      asideIndex,
      "la sidebar debe emitirse antes de <main> para no bloquear el shell mientras el slot de la página espera datos lentos",
    ).toBeLessThan(mainIndex);
  });
});
