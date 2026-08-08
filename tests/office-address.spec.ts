import "dotenv/config";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { db } from "../src/db/index";
import { users, offices, sessions } from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

let testUserId: number;
const username = `test_addr_${Date.now()}`;
const password = "TestPass1234";
let hashedPassword: string;

test.beforeAll(async () => {
  hashedPassword = await bcrypt.hash(password, 4);
  const [newUser] = await db
    .insert(users)
    .values({ username, password: hashedPassword, role: "admin" })
    .returning({ id: users.id });
  testUserId = newUser.id;
});

test.afterAll(async () => {
  await db.delete(sessions).where(eq(sessions.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));
});

async function loginAsAdmin(page: Page) {
  const response = await page.request.post("/login", {
    form: { username, password },
    redirect: "manual",
  });
  expect(response.status()).toBe(200);
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "session_id")).toBeTruthy();
}

test("address suggestions return unique canonical addresses", async ({ page }) => {
  await loginAsAdmin(page);

  const officeRows = await db.select({ id: offices.id }).from(offices).limit(1);
  test.skip(officeRows.length === 0, "No offices in current DB");
  const officeId = officeRows[0].id;

  const response = await page.request.get(
    `/api/offices/search-address?q=santa&excludeId=${officeId}`,
  );
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(Array.isArray(data)).toBeTruthy();
  for (const suggestion of data) {
    expect(suggestion.address).toBe(suggestion.address.toUpperCase());
    expect(Array.isArray(suggestion.offices)).toBeTruthy();
    for (const office of suggestion.offices) {
      expect(typeof office.code).toBe("string");
      expect(typeof office.name).toBe("string");
      expect(typeof office.provinceName).toBe("string");
      expect(typeof office.regionName).toBe("string");
    }
  }
});

test("rejects anonymous requests with 401", async ({ request }) => {
  const response = await request.get("/api/offices/search-address?q=santa");
  expect(response.status()).toBe(401);
});

test("returns empty array for query shorter than 3 chars", async ({ page }) => {
  await loginAsAdmin(page);
  const response = await page.request.get("/api/offices/search-address?q=ab");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data).toEqual([]);
});
