// tests/cronograma/ssr-initial-data.spec.ts
//
// #267: el primer render del cronograma no debe pedir el payload por API.
// El servidor lo embebe en `window.__CRONOGRAMA_INITIAL_DATA__` y el cliente
// lo consume (y lo borra) durante su init.
import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(user.userId, user.sessionId);
});

test.describe("datos iniciales por SSR", () => {
  test("el primer render no pide /api/cronograma y consume el dato inicial", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, user.signedSessionId);

    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));

    await page.goto("/supervision/cronograma");
    await expect(page.locator("#monthly-view tbody tr").first()).toBeVisible({
      timeout: 20000,
    });

    const apiCalls = requests.filter(
      (u) => new URL(u).pathname === "/api/cronograma",
    );
    expect(apiCalls).toHaveLength(0);

    // El canal SSR se consumió: el cliente hace delete del global al usarlo.
    expect(
      await page.evaluate(() =>
        Boolean(
          (window as unknown as Record<string, unknown>)
            .__CRONOGRAMA_INITIAL_DATA__,
        ),
      ),
    ).toBe(false);
  });
});
