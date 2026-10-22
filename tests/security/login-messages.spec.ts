import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import { users } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

let testUserId: number;
const knownUsername = `test_loginmsg_${Date.now()}`;
const knownPassword = "TestPass1234";

// Pre-computed bcrypt hash for test user
let hashedPassword: string;

test.beforeAll(async () => {
  hashedPassword = await bcrypt.hash(knownPassword, 4);

  const [newUser] = await db
    .insert(users)
    .values({
      username: knownUsername,
      password: hashedPassword,
      role: "agent",
    })
    .returning({ id: users.id });
  testUserId = newUser.id;
});

test.afterAll(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

test.describe("Login shell", () => {
  test("no renderiza sidebar ni header autenticado", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("nav.navbar")).toHaveCount(0);
    await expect(page.locator("#main-drawer")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Portal MDA" }),
    ).toBeVisible();
    const generatorLink = page.getByRole("link", {
      name: /generador de firmas/i,
    });
    await expect(generatorLink).toHaveAttribute("href", /\/generador-firmas$/);
    await expect
      .poll(() =>
        page
          .locator("main img")
          .first()
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  });
});

test.describe("Generador de firmas público", () => {
  test("usa chrome mínimo sin sidebar ni búsqueda", async ({ page }) => {
    await page.goto("/generador-firmas");

    await expect(page.locator("#main-drawer")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /búsqueda maestra/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /iniciar sesión/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Generador de firmas" }),
    ).toBeVisible();
  });
});

test.describe("S3.2 Login message enumeration", () => {
  test("wrong password returns generic message", async ({ request }) => {
    const response = await request.post("/login", {
      form: { username: knownUsername, password: "WrongPassword!" },
      redirect: "manual",
    });
    expect(response.status()).toBe(302);
    const location = response.headers()["location"] || "";
    expect(location).toContain("toast_msg=");
    expect(location).toContain(encodeURIComponent("Credenciales inválidas"));
    expect(location).not.toContain("Contraseña");
  });

  test("non-existent user returns same generic message", async ({
    request,
  }) => {
    const response = await request.post("/login", {
      form: { username: `nonexistent_${Date.now()}`, password: "AnyPass123!" },
      redirect: "manual",
    });
    expect(response.status()).toBe(302);
    const location = response.headers()["location"] || "";
    expect(location).toContain(encodeURIComponent("Credenciales inválidas"));
  });

  test("correct password returns success redirect", async ({ request }) => {
    const response = await request.post("/login", {
      form: { username: knownUsername, password: knownPassword },
      redirect: "manual",
    });
    expect(response.status()).toBe(302);
    const location = response.headers()["location"] || "";
    // Successful login redirects to / (cleanBase) without toast_msg
    expect(location).not.toContain("toast_msg");
  });
});
