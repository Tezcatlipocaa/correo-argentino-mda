import { test, expect } from "@playwright/test";
import { db } from "../../src/db/index";
import { users, sessions, workflowStages, workflowStageTickets, auditLogs } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { createHmac, randomUUID } from "crypto";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function signSessionId(sessionId: string): string {
  const signature = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

interface TestUser {
  id: number;
  username: string;
  role: string;
  rawSessionId: string;
  signedSessionId: string;
}

async function createTestUser(role: string): Promise<TestUser> {
  const suffix = randomUUID();
  const username = `etapas_${role}_${suffix}`;
  const sessionId = `session_${suffix}`;
  const signed = signSessionId(sessionId);
  const [user] = await db
    .insert(users)
    .values({ username, password: "hashed_fake_password", role })
    .returning({ id: users.id });
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });
  return {
    id: user.id,
    username,
    role,
    rawSessionId: sessionId,
    signedSessionId: signed,
  };
}

let adminUser: TestUser;
let agentUser: TestUser;
const createdStageIds: number[] = [];

test.beforeAll(async () => {
  adminUser = await createTestUser("admin");
  agentUser = await createTestUser("agent");
});

test.afterAll(async () => {
  for (const stageId of createdStageIds) {
    const [before] = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.id, stageId));
    if (before) {
      await db
        .delete(workflowStageTickets)
        .where(eq(workflowStageTickets.stageId, stageId));
      await db
        .delete(workflowStages)
        .where(eq(workflowStages.id, stageId));
    }
  }
  for (const user of [adminUser, agentUser]) {
    await db.delete(sessions).where(eq(sessions.id, user.rawSessionId));
    await db.delete(users).where(eq(users.id, user.id));
  }
});

async function login(context: any, user: TestUser) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "session_id",
      value: user.signedSessionId,
      domain: "localhost",
      path: "/",
    },
  ]);
}

test.describe("Etapas del workflow (admin CRUD)", () => {
  test("agente no accede a la configuración", async ({ page, context }) => {
    await login(context, agentUser);
    await page.goto("/admin/automatizaciones/etapas");
    // Agent autenticado con permiso denegado: el middleware lo manda a home.
    await expect(page).not.toHaveURL(/admin\/automatizaciones\/etapas/);
    await expect(page.locator("main h1").first()).not.toContainText(
      "Etapas del Workflow",
    );
  });

  test("admin ve el listado sembrado, crea etapa, agrega ticket y elimina todo", async ({
    page,
    context,
  }) => {
    await login(context, adminUser);

    // 1. Listado: muestra las etapas del seed
    await page.goto("/admin/automatizaciones/etapas");
    await expect(page.locator("main h1").first()).toContainText(
      "Etapas del Workflow",
    );
    await expect(
      page.locator("[data-table-row]", {
        hasText: "Etapa 1 — Lanzamiento y habilitación",
      }),
    ).toBeVisible();
    await expect(
      page.locator("[data-table-row]", {
        hasText: "Etapa 2 — Configuración y registro",
      }),
    ).toBeVisible();

    // 2. Crear una etapa nueva
    await page.goto("/admin/automatizaciones/etapas/create");
    const stageName = `Etapa test ${Date.now()}`;
    await page.fill("#input-name", stageName);
    await page.fill("#input-position", "99");
    await page.fill("#input-description", "Etapa creada por test E2E.");
    await page.selectOption("#select-gate", "none");
    await page.locator("#etapa-form").getByRole("button").last().click();
    await expect(
      page.locator("#global-toast-container", { hasText: stageName }),
    ).toBeVisible();

    const row = page.locator("[data-table-row]", { hasText: stageName });
    await expect(row).toBeVisible();
    const stageId = Number(await row.getAttribute("data-sort-id"));
    createdStageIds.push(stageId);

    // 3. Editar: agregar un ticket esperado (respuesta AJAX + recarga)
    await page.goto(`/admin/automatizaciones/etapas/edit/${stageId}`);
    await page.fill("#add-tl", "Test Gestión E2E");
    await page.fill("#add-td", "Display de prueba");
    await page.fill("#add-tp", "1");
    await page.fill("#add-ta", "Alias E2E uno\nAlias E2E dos");
    await page.fill("#add-tdesc", "frase descripcion uno\nfrase descripcion dos");
    await page.getByRole("button", { name: "Agregar" }).click();
    await expect(
      page.getByRole("heading", { name: "Tickets esperados (1)" }),
    ).toBeVisible({ timeout: 20000 });

    const inserted = await db
      .select()
      .from(workflowStageTickets)
      .where(eq(workflowStageTickets.stageId, stageId));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].matchLabel).toBe("Test Gestión E2E");
    expect(inserted[0].blocking).toBe(true);
    expect(inserted[0].aliases).toEqual(["Alias E2E uno", "Alias E2E dos"]);
    expect(inserted[0].matchDescription).toEqual([
      "frase descripcion uno",
      "frase descripcion dos",
    ]);

    // 4. Eliminar la etapa (el ticket cae por cascade)
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/admin/automatizaciones/etapas");
    await page
      .locator(`form[action$="/edit/${stageId}/eliminar"]`)
      .first()
      .locator("button")
      .click();
    await page.waitForURL(/admin\/automatizaciones\/etapas(\?|$)/);

    const remaining = await db
      .select()
      .from(workflowStages)
      .where(eq(workflowStages.id, stageId));
    expect(remaining).toHaveLength(0);

    // 5. Auditoría registra la eliminación
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.username, adminUser.username));
    expect(
      logs.filter((log) => log.action.includes("Eliminó el etapa")),
    ).not.toHaveLength(0);
    createdStageIds.pop();
  });
});
