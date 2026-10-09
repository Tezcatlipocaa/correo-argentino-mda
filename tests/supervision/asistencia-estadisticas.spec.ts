import { expect, test } from "@playwright/test";
import "dotenv/config";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/db/index";
import { sessions, users, mesas } from "../../src/db/schema";
import { MDA_TI_HELPDESK } from "../../src/lib/helpdeskAccess";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function sign(sessionId: string): string {
  const sig = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

test.describe("Estadísticas de asistencia sin CDN (#183)", () => {
  const stamp = Date.now();
  const sessionId = `sess_asist_stats_${stamp}`;
  const username = `sup_stats_${stamp}`;
  let userId = 0;
  let cookie = "";

  test.beforeAll(async () => {
    // Resolver la mesa por nombre (invgateId varía según el entorno).
    const [mda] = await db
      .select({ invgateId: mesas.invgateId })
      .from(mesas)
      .where(eq(mesas.name, MDA_TI_HELPDESK));
    test.skip(
      !mda,
      `Mesa "${MDA_TI_HELPDESK}" no existe en este entorno; no se puede sembrar el usuario`,
    );
    const [row] = await db
      .insert(users)
      .values({
        username,
        password: "x",
        role: "supervisor",
        helpdeskId: mda.invgateId,
      })
      .returning({ id: users.id });
    userId = row.id;
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: Date.now() + 86_400_000,
    });
    cookie = sign(sessionId);
  });

  test.afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  test("renderiza los gráficos sin pedir Chart.js a un CDN", async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("cdn.jsdelivr.net")) {
        externalRequests.push(request.url());
      }
    });

    await page.context().addCookies([
      { name: "session_id", value: cookie, domain: "localhost", path: "/" },
    ]);
    await page.goto("/supervision/asistencia/estadisticas");

    await expect(page.locator("#analytics-month")).toBeVisible();
    const canvas = page
      .locator("[data-chart-card] canvas[data-chart-canvas]:not(.hidden)")
      .first();
    const empty = page.locator("[data-chart-empty]:not(.hidden)").first();
    await expect(canvas.or(empty).first()).toBeVisible();
    await expect(page.locator("[data-table-toggle]").first()).toBeVisible();
    expect(externalRequests).toEqual([]);
  });
});
