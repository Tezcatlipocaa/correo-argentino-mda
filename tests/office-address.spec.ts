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

  const officeRows = await db
    .select({ id: offices.id, address: offices.address })
    .from(offices)
    .limit(1);
  test.skip(officeRows.length === 0, "No offices in current DB");
  const officeId = officeRows[0].id;
  const officeAddress = officeRows[0].address;
  test.skip(!officeAddress, "No office with address in current DB");

  const trimmed = officeAddress!.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  const query = firstWord.length >= 3 ? firstWord : trimmed;
  test.skip(query.length < 3, "Address too short for query");

  const response = await page.request.get(
    `/api/offices/search-address?q=${encodeURIComponent(query)}&excludeId=${officeId}`,
  );
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(Array.isArray(data)).toBeTruthy();
  expect(data.length).toBeGreaterThan(0);
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

test("selecting existing address shows same-building preview below input", async ({ page }) => {
  await loginAsAdmin(page);

  const officeRows = await db
    .select({ id: offices.id, provinceCode: offices.provinceCode })
    .from(offices)
    .limit(1);
  test.skip(officeRows.length === 0, "No offices in current DB");
  const officeId = officeRows[0].id;
  const officeProvince = officeRows[0].provinceCode ?? "";

  const suggestionsResponse = await page.request.get(
    `/api/offices/search-address?q=santa&excludeId=${officeId}&provinceCode=${officeProvince}`,
  );
  const suggestions = (await suggestionsResponse.json()) as { address: string; offices: unknown[] }[];
  const withOffices = suggestions.find((s) => s.offices.length > 0);
  test.skip(!withOffices, "No shared-address offices in current DB");

  await page.goto(`/oficinas/edit/${officeId}`);

  const input = page.locator("#input-address");
  const query = withOffices!.address.trim();
  await input.fill(query);

  const option = page.locator("#address-suggestions [role=option]", { hasText: withOffices!.address }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page.locator("#address-building-preview")).toBeVisible();
  await expect(page.locator("#address-building-confirmed")).toBeVisible();
  await expect(page.locator("#address-building-preview [data-sibling-office]").first()).toBeVisible();
});

test("blocks save until shared-site confirmation is checked", async ({ page }) => {
  await loginAsAdmin(page);

  const officeRows = await db
    .select({ id: offices.id, address: offices.address, provinceCode: offices.provinceCode })
    .from(offices)
    .limit(1);
  test.skip(officeRows.length === 0, "No offices in current DB");
  const officeId = officeRows[0].id;
  const officeAddress = officeRows[0].address;
  const officeProvince = officeRows[0].provinceCode ?? "";
  test.skip(!officeAddress, "No office with address in current DB");

  const trimmed = officeAddress!.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  const query = firstWord.length >= 3 ? firstWord : trimmed;
  test.skip(query.length < 3, "Address too short for query");

  const suggestionsResponse = await page.request.get(
    `/api/offices/search-address?q=${encodeURIComponent(query)}&excludeId=${officeId}&provinceCode=${officeProvince}`,
  );
  const suggestions = (await suggestionsResponse.json()) as { address: string; offices: unknown[] }[];
  const withOffices = suggestions.find((s) => s.offices.length > 0);
  test.skip(!withOffices, "No shared-address offices in current DB");

  await page.goto(`/oficinas/edit/${officeId}`);
  const input = page.locator("#input-address");
  await input.fill(withOffices!.address);

  const option = page.locator("#address-suggestions [role=option]", { hasText: withOffices!.address }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page.locator("#address-building-preview")).toBeVisible();
  await page.locator("#office-form button[type=submit]").first().click();

  await expect(page.locator("#address-building-confirmed")).not.toBeChecked();
  await expect(page).toHaveURL(new RegExp(`/oficinas/edit/${officeId}$`));
  await expect(page.locator("#global-toast-container")).toContainText(
    "Confirmá si las oficinas comparten sitio.",
  );
});

test("changing to unmatched address hides shared-site preview", async ({ page }) => {
  await loginAsAdmin(page);
  const officeRows = await db.select({ id: offices.id }).from(offices).limit(1);
  test.skip(officeRows.length === 0, "No offices in current DB");
  const officeId = officeRows[0].id;

  await page.goto(`/oficinas/edit/${officeId}`);
  const input = page.locator("#input-address");
  await input.fill("DOMICILIO INEXISTENTE 999999");
  await page.waitForTimeout(600);
  await expect(page.locator("#address-building-preview")).toBeHidden();
});
