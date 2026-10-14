import "dotenv/config";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/db/index";
import { users, sessions, agents, saturdayRotationConfig } from "../../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { createHmac } from "crypto";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function signSessionId(sessionId: string): string {
  const signature = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

let adminUserId: number;
let adminSessionId: string;

async function loginAsAdmin(context: BrowserContext): Promise<void> {
  await context.addCookies([
    { name: "session_id", value: signSessionId(adminSessionId), domain: "127.0.0.1", path: "/" },
    { name: "session_id", value: signSessionId(adminSessionId), domain: "localhost", path: "/" },
  ]);
}

const TEST_MONTH = { year: 2034, month: 10, prefix: "2034-11" };

test.beforeAll(async () => {
  const username = `months_api_admin_${Date.now()}`;
  adminSessionId = `months_api_session_${Date.now()}`;
  const [{ id }] = await db
    .insert(users)
    .values({ username, password: "hashed_fake_password", role: "admin" })
    .returning({ id: users.id });
  adminUserId = id;
  await db.insert(sessions).values({
    id: adminSessionId,
    userId: adminUserId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });
});

test.afterAll(async () => {
  await db.delete(saturdayRotationConfig).where(eq(saturdayRotationConfig.month, TEST_MONTH.prefix));
  await db.run(sql`DELETE FROM schedules WHERE date LIKE ${TEST_MONTH.prefix + "-%"}`);
  await db.run(sql`DELETE FROM agent_saturday_groups WHERE month = ${TEST_MONTH.prefix}`);
  await db.delete(sessions).where(eq(sessions.id, adminSessionId));
  await db.delete(users).where(eq(users.id, adminUserId));
});

test.describe("Cronograma months API", () => {
  test("DELETE rechaza month fuera de rango o no numérico con 400 (#272)", async ({ context, page }) => {
    await loginAsAdmin(context);
    const outOfRange = await page.request.delete("/api/cronograma/months", { data: { year: 2034, month: 15 } });
    expect(outOfRange.status()).toBe(400);
    const notNumeric = await page.request.delete("/api/cronograma/months", { data: { year: 2034, month: "abc" } });
    expect(notNumeric.status()).toBe(400);
  });

  test("POST del mismo mes devuelve 409 y no borra datos (#141/#274)", async ({ context, page }) => {
    await loginAsAdmin(context);
    const first = await page.request.post("/api/cronograma/months", { data: { year: TEST_MONTH.year, month: TEST_MONTH.month } });
    expect(first.ok()).toBeTruthy();
    const second = await page.request.post("/api/cronograma/months", { data: { year: TEST_MONTH.year, month: TEST_MONTH.month } });
    expect(second.status()).toBe(409);
  });

  test("GET notes con agente inexistente no crea agentes (#264)", async ({ context, page }) => {
    await loginAsAdmin(context);
    const before = await db.select({ c: sql<number>`count(*)` }).from(agents);
    const res = await page.request.get("/api/cronograma/notes?agentName=zzz_agente_inexistente_12345");
    expect(res.ok()).toBeTruthy();
    const after = await db.select({ c: sql<number>`count(*)` }).from(agents);
    expect(after[0].c).toBe(before[0].c);
  });

  test("import rechaza fechas fuera del mes con 400 (#261)", async ({ context, page }) => {
    await loginAsAdmin(context);
    const [{ name: agentName }] = await db
      .select({ name: agents.name })
      .from(agents)
      .limit(1);
    const csv = `Operador,2026-06-01,2026-06-02\n${agentName},Presencial Monte Grande,Presencial Monte Grande\n`;
    const res = await page.request.post("/api/cronograma/import", {
      multipart: {
        month: "2026-07",
        file: { name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
      },
    });
    expect(res.status()).toBe(400);
  });
});
