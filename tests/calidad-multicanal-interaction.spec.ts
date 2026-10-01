import "dotenv/config";
import { test, expect } from "@playwright/test";
import { db } from "../src/db/index";
import { users, sessions, mesas } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

const SECRET_KEY =
  process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function signSessionId(sessionId: string): string {
  const signature = createHmac("sha256", SECRET_KEY)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

let testUserId: number;
let testRawSessionId: string;
let testSignedSessionId: string;

test.beforeAll(async () => {
  const mesaName = "TI_GSM_MDA TI";
  let [mesa] = await db
    .select({ invgateId: mesas.invgateId })
    .from(mesas)
    .where(eq(mesas.name, mesaName));
  if (!mesa) {
    await db
      .insert(mesas)
      .values({
        invgateId: 910002,
        name: mesaName,
        displayName: null,
        active: true,
        assignable: true,
        lastSyncedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
    [mesa] = await db
      .select({ invgateId: mesas.invgateId })
      .from(mesas)
      .where(eq(mesas.name, mesaName));
  }

  const username = `sup_calidad_test_${Date.now()}`;
  testRawSessionId = `test-calidad-session-${Date.now()}`;
  testSignedSessionId = signSessionId(testRawSessionId);

  const [newUser] = await db
    .insert(users)
    .values({
      username,
      password: "hashed_fake_password",
      role: "supervisor",
      helpdeskId: mesa?.invgateId ?? null,
      helpdeskName: mesa ? mesaName : null,
    })
    .returning({ id: users.id });

  testUserId = newUser.id;

  await db.insert(sessions).values({
    id: testRawSessionId,
    userId: testUserId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });
});

test.afterAll(async () => {
  if (testRawSessionId) {
    await db.delete(sessions).where(eq(sessions.id, testRawSessionId));
  }
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId));
  }
});

test.describe("Interacción Calidad Operadores - Selección y Modal", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "session_id",
        value: testSignedSessionId,
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("Debe permitir seleccionar operador, mostrar panel de detalle y abrir modal de auditoría", async ({
    page,
  }) => {
    page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("BROWSER ERROR:", err));

    await page.goto("/supervision/calidad-operadores");

    // Esperar a que el server island cargue los operadores
    const operatorItems = page.locator(".operator-item");
    await expect(operatorItems.first()).toBeVisible({ timeout: 10000 });

    const initialGeneralPanel = page.locator("#general-info-panel");
    const detailsPanel = page.locator("#operator-details-panel");

    await expect(initialGeneralPanel).toBeVisible();
    await expect(detailsPanel).toHaveClass(/hidden/);

    // Hacer click en el primer operador
    const firstOperator = operatorItems.first();
    const operatorName = await firstOperator.locator("div.text-base-content").first().innerText();
    await firstOperator.click();

    // El panel de detalle debe hacerse visible y el general ocultarse
    await expect(detailsPanel).not.toHaveClass(/hidden/);
    await expect(initialGeneralPanel).toHaveClass(/hidden/);

    // Verificar que el nombre del operador se haya cargado en el detalle
    const detailName = page.locator("#detail-name");
    await expect(detailName).toHaveText(operatorName);

    // Verificar que el botón de nueva auditoría es visible y clickeable
    const btnNewAudit = page.locator("#btn-new-audit");
    await expect(btnNewAudit).toBeVisible();
    await btnNewAudit.click();

    // El modal de auditoría debe abrirse
    const modal = page.locator("#audit-modal");
    await expect(modal).toHaveAttribute("open", "");

    // Verificar que las pestañas de canal del modal funcionan
    const wiseEmailBtn = page.locator('.channel-btn[data-channel="wise_email"]');
    await wiseEmailBtn.click();
    await expect(page.locator("#channel-checklist-wise_email")).toBeVisible();
    await expect(page.locator("#channel-checklist-wise_call")).toHaveClass(/hidden/);

    const invgateAgBtn = page.locator('.channel-btn[data-channel="invgate_ticket"]');
    await invgateAgBtn.click();
    await expect(page.locator("#channel-checklist-invgate_ticket")).toBeVisible();
    await expect(page.locator("#channel-checklist-wise_email")).toHaveClass(/hidden/);

    // Cerrar el modal
    const btnCloseModal = page.locator("#btn-close-modal");
    await btnCloseModal.click();
    await expect(modal).not.toHaveAttribute("open", "");

    // Probar abrir Nueva Auditoría desde la pestaña Mails Wise del operador
    const opEmailTab = page.locator('.operator-channel-tab[data-channel="wise_email"]');
    await opEmailTab.click();
    await expect(opEmailTab).toHaveClass(/tab-active/);

    await btnNewAudit.click();
    await expect(modal).toHaveAttribute("open", "");
    await expect(page.locator("#channel-checklist-wise_email")).toBeVisible();
    await expect(page.locator('.channel-btn[data-channel="wise_email"]')).toHaveClass(/btn-active/);

    await btnCloseModal.click();
    await expect(modal).not.toHaveAttribute("open", "");

    // Probar abrir Nueva Auditoría desde la pestaña Autogestiones del operador
    const opAgTab = page.locator('.operator-channel-tab[data-channel="invgate_ticket"]');
    await opAgTab.click();
    await expect(opAgTab).toHaveClass(/tab-active/);

    await btnNewAudit.click();
    await expect(modal).toHaveAttribute("open", "");
    await expect(page.locator("#channel-checklist-invgate_ticket")).toBeVisible();
    await expect(page.locator('.channel-btn[data-channel="invgate_ticket"]')).toHaveClass(/btn-active/);

    await btnCloseModal.click();
    await expect(modal).not.toHaveAttribute("open", "");

    // Probar volver al panel general
    const btnBack = page.locator("#btn-back-to-summary");
    await btnBack.click();
    await expect(initialGeneralPanel).not.toHaveClass(/hidden/);
    await expect(detailsPanel).toHaveClass(/hidden/);
  });
});
