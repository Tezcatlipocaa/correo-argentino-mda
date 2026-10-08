import "dotenv/config";
import { expect, test } from "@playwright/test";
import { db } from "../src/db/index";
import { agents, users, qualityAudits, auditScores } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { createTestUserAndSession, cleanupTestUser, setSessionCookie, type TestUser } from "./helpers/auth";

let testSupervisor: TestUser;
let createdAgentId: number | null = null;

test.beforeEach(async ({ context }) => {
  testSupervisor = await createTestUserAndSession("admin");
  await setSessionCookie(context, testSupervisor.signedSessionId);

  // Create an agent included in quality module
  const [newAgent] = await db
    .insert(agents)
    .values({
      name: "Operador Test Calidad",
      username: testSupervisor.username,
      userId: testSupervisor.userId,
      incluidoCalidad: true,
      active: true,
      role: "agent",
    })
    .returning({ id: agents.id });

  createdAgentId = newAgent.id;
});

test.afterEach(async () => {
  if (createdAgentId) {
    const audits = await db.select().from(qualityAudits).where(eq(qualityAudits.agentId, createdAgentId));
    for (const a of audits) {
      await db.delete(auditScores).where(eq(auditScores.auditId, a.id));
    }
    await db.delete(qualityAudits).where(eq(qualityAudits.agentId, createdAgentId));
    await db.delete(agents).where(eq(agents.id, createdAgentId));
  }
  if (testSupervisor) {
    await cleanupTestUser(testSupervisor.userId, testSupervisor.sessionId);
  }
});

test("Calidad Multi-Canal E2E Flow", async ({ page }) => {
  await page.goto("/supervision/calidad-operadores");

  // Wait for server island to finish streaming
  await expect(page.locator("#operators-data")).toBeAttached({ timeout: 15000 });

  // Verify page header
  await expect(page.locator("h1")).toContainText(/Calidad|Supervisión/i);

  // Select the test operator
  const operatorRow = page.locator(`.operator-item:has-text("Operador Test Calidad")`).first();
  await expect(operatorRow).toBeVisible();
  await operatorRow.click();

  // Verify detail view loads with multi-channel tabs
  await expect(page.locator("#operator-channel-tabs")).toBeVisible();
  await expect(page.locator('.operator-channel-tab[data-channel="wise_call"]')).toBeVisible();
  await expect(page.locator('.operator-channel-tab[data-channel="wise_email"]')).toBeVisible();
  await expect(page.locator('.operator-channel-tab[data-channel="invgate_ticket"]')).toBeVisible();

  // Verify quota badge
  await expect(page.locator("#quota-progress-badge")).toContainText("Completadas");

  // Open audit modal
  const btnNewAudit = page.locator("#btn-new-audit");
  await expect(btnNewAudit).toBeVisible();
  await btnNewAudit.click();

  // En el refactor de UI, Nueva Auditoría navega a la vista dedicada /nueva
  await expect(page).toHaveURL(/supervision\/calidad-operadores\/nueva/);
  await expect(page.locator("h1")).toContainText(/Nueva Auditoría/i);

  // Test channel switching inside form
  const emailBtn = page.locator('.channel-btn[data-channel="wise_email"]');
  await emailBtn.click();
  await expect(page.locator("#channel-checklist-wise_email")).toBeVisible();
  await expect(page.locator("#channel-checklist-wise_call")).toBeHidden();

  // Test conditional toggle in email (appliesMda)
  const toggleMda = page.locator("#toggle-applies-mda");
  await expect(toggleMda).toBeAttached();

  // Switch to Autogestión
  const agBtn = page.locator('.channel-btn[data-channel="invgate_ticket"]');
  await agBtn.click();
  await expect(page.locator("#channel-checklist-invgate_ticket")).toBeVisible();
  await expect(page.locator("#meta-pas-container")).toBeVisible();

  // Fill and save a test audit for AG
  await page.locator("#form-ticket-id").fill("INC-E2E-TEST");
  await page.locator("#form-date").fill("2026-10-01");
  await page.locator("#form-notes").fill("Auditoría de prueba automatizada E2E");

  // Uncheck one parameter to verify scoring deduction
  const firstAgCheckbox = page.locator("#channel-checklist-invgate_ticket .audit-checkbox").first();
  await firstAgCheckbox.uncheck();

  // Score should be less than 100%
  const totalPreview = page.locator("#preview-total");
  await expect(totalPreview).not.toHaveText("100%");

  // Save audit
  const btnSubmit = page.locator("button[type='submit']:has-text('Guardar')");
  await btnSubmit.click();

  // Wait for redirect back to quality main page
  await page.waitForURL(/\/supervision\/calidad-operadores(\?|$)/);
});
