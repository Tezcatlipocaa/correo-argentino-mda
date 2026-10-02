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

  test("Debe soportar buscador dual, visor de ticket en vivo y auto-evaluación asistida de títulos", async ({
    page,
  }) => {
    await page.goto("/supervision/calidad-operadores");

    const operatorItems = page.locator(".operator-item");
    await expect(operatorItems.first()).toBeVisible({ timeout: 10000 });
    await operatorItems.first().click();

    const btnNewAudit = page.locator("#btn-new-audit");
    await btnNewAudit.click();

    const modal = page.locator("#audit-modal");
    await expect(modal).toHaveAttribute("open", "");

    // 1. Verificar presencia de buscador dual en llamadas Wise
    const wiseSearch = page.locator("#wise-search-container");
    const invgateSearch = page.locator("#invgate-search-container");
    await expect(wiseSearch).toBeVisible();
    await expect(invgateSearch).toBeVisible();

    // 2. Verificar que en Autogestión se oculta buscador Wise
    const agBtn = page.locator('.channel-btn[data-channel="invgate_ticket"]');
    await agBtn.click();
    await expect(wiseSearch).toHaveClass(/hidden/);
    await expect(invgateSearch).toBeVisible();
    await expect(page.locator("#btn-fetch-invgate-label")).toHaveText("Buscar Autogestión");

    // Volver a canal Llamada Wise
    const callBtn = page.locator('.channel-btn[data-channel="wise_call"]');
    await callBtn.click();
    await expect(wiseSearch).not.toHaveClass(/hidden/);

    // 3. Verificar acordeón del visor de ticket en vivo
    const tvHeader = page.locator("#ticket-viewer-header");
    const tvContent = page.locator("#ticket-viewer-content");
    await expect(tvContent).toHaveClass(/hidden/);
    await tvHeader.click();
    await expect(tvContent).not.toHaveClass(/hidden/);

    // 4. Verificar que Falla Crítica de Proceso no existe en el modal
    await expect(page.locator("#form-is-critical-failure")).not.toBeAttached();

    // 5. Mockear respuesta de InvGate con HTML en descripción y título homologado
    let mockTitle = "Aforadora- Consulta";
    await page.route("**/api/calidad/fetch-metadata*source=invgate*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            caseNumber: "88442",
            title: mockTitle,
            category: "Hardware",
            priority: "Alta",
            status: "En curso",
            creator: "Juan Pérez",
            description: "<p>Falla en equipo aforadora <strong>sucursal</strong>.<br>No imprime comprobante.</p>",
            date: "2026-10-01",
          },
        }),
      });
    });

    // Realizar búsqueda en InvGate
    await page.locator("#invgate-search-id").fill("88442");
    await page.locator("#btn-fetch-invgate-api").click();

    // 6. Verificar que el visor de ticket se actualizó y la descripción no tiene tags HTML
    const tvTitle = page.locator("#tv-title");
    await expect(tvTitle).toHaveText("Aforadora- Consulta");
    await expect(page.locator("#tv-category")).toHaveText("Hardware");
    await expect(page.locator("#tv-priority")).toHaveText("Alta");
    await expect(page.locator("#tv-creator")).toHaveText("Juan Pérez");

    const tvDescription = page.locator("#tv-description");
    await expect(tvDescription).toContainText("Falla en equipo aforadora sucursal.");
    await expect(tvDescription).not.toContainText("<p>");
    await expect(tvDescription).not.toContainText("<strong>");
    await expect(tvDescription).not.toContainText("<br>");

    // 7. Verificar auto-evaluación asistida del parámetro Título (Homologado)
    const tvTitleBadge = page.locator("#tv-title-match-badge");
    await expect(tvTitleBadge).toContainText("Título Homologado");

    const titleCheckbox = page.locator('input[name="call_ticket_titulo"]');
    await expect(titleCheckbox).toBeChecked();

    const titleRuleBadge = page.locator('.rule-auto-badge[data-rule-badge="call_ticket_titulo"]');
    await expect(titleRuleBadge).toHaveClass(/hidden/);

    // 8. Probar búsqueda con Título No Homologado
    mockTitle = "Titulo Inexistente No Homologado 999";
    await page.locator("#invgate-search-id").fill("88443");
    await page.locator("#btn-fetch-invgate-api").click();

    // Verificar que badge dice "No Homologado" sin símbolo ⚠
    await expect(tvTitleBadge).toHaveText("No Homologado");
    await expect(tvTitleBadge).not.toContainText("⚠");

    // Verificar que el checkbox se desmarca y aparece el badge de "Desactivado por regla"
    await expect(titleCheckbox).not.toBeChecked();
    await expect(titleRuleBadge).not.toHaveClass(/hidden/);
    await expect(titleRuleBadge).toHaveText("Desactivado por regla");

    // 9. Verificar que si el usuario activa manualmente el checkbox, el badge de regla se oculta
    await titleCheckbox.check();
    await expect(titleCheckbox).toBeChecked();
    await expect(titleRuleBadge).toHaveClass(/hidden/);

    // 10. Verificar que el número de ticket se asignó en el formulario
    await expect(page.locator("#form-ticket-id")).toHaveValue("88442");

    // Cerrar modal
    await page.locator("#btn-close-modal").click();
    await expect(modal).not.toHaveAttribute("open", "");
  });

  test("Debe soportar toggle de ticket en Llamadas y Mails con recálculo dinámico proporcional", async ({
    page,
  }) => {
    await page.goto("/supervision/calidad-operadores");

    const operatorItems = page.locator(".operator-item");
    await expect(operatorItems.first()).toBeVisible({ timeout: 10000 });
    await operatorItems.first().click();

    const btnNewAudit = page.locator("#btn-new-audit");
    await btnNewAudit.click();

    const modal = page.locator("#audit-modal");
    await expect(modal).toHaveAttribute("open", "");

    // --- A. Canal Llamadas Wise ---
    const toggleCallTicket = page.locator("#toggle-call-generated-ticket");
    await expect(toggleCallTicket).toBeVisible();
    await expect(toggleCallTicket).toBeChecked();

    const callTicketBlock = page.locator("#wise-call-ticket-block");
    const callTicketPlaceholder = page.locator("#wise-call-ticket-placeholder");
    await expect(callTicketBlock).toBeVisible();
    await expect(callTicketPlaceholder).toHaveClass(/hidden/);

    // Verificar lista canónica de parámetros en llamada
    await expect(page.locator('input[name="call_solicitud"]')).not.toBeAttached();
    await expect(page.locator('input[name="call_ticket_reclamo_novedad"]')).not.toBeAttached();

    // Scores iniciales (100% en todo)
    const previewS1 = page.locator("#preview-s1");
    const previewS2 = page.locator("#preview-s2");
    const previewTotal = page.locator("#preview-total");
    const previewS2Block = page.locator("#preview-s2-block");

    await expect(previewS1).toHaveText("100%");
    await expect(previewS2).toHaveText("100%");
    await expect(previewTotal).toHaveText("100%");

    // Desmarcar toggle ¿Se generó ticket? en llamada
    await toggleCallTicket.uncheck();
    await expect(callTicketBlock).toHaveClass(/hidden/);
    await expect(callTicketPlaceholder).not.toHaveClass(/hidden/);
    await expect(callTicketPlaceholder).toContainText("No se generó ticket para esta llamada");

    // Con sección 2 desactivada: S2 = 0%, S1 = 100%, Total = 100% (solo puntúa S1)
    await expect(previewS1).toHaveText("100%");
    await expect(previewS2).toHaveText("0%");
    await expect(previewTotal).toHaveText("100%");
    await expect(previewS2Block).toHaveCSS("opacity", "0.3");

    // Desmarcar un ítem de sección 1: Cumplimiento de procedimiento (-10%)
    // Base 45: 35/45 = 78%
    const procCheckbox = page.locator('input[name="call_procedimiento"]');
    await procCheckbox.uncheck();
    await expect(previewS1).toHaveText("78%");
    await expect(previewS2).toHaveText("0%");
    await expect(previewTotal).toHaveText("78%");

    // Volver a activar toggle ¿Se generó ticket?
    await toggleCallTicket.check();
    await expect(callTicketBlock).not.toHaveClass(/hidden/);
    await expect(callTicketPlaceholder).toHaveClass(/hidden/);
    // Ahora Sección 2 aporta 55 puntos directos: 35 + 55 = 90%
    await expect(previewS1).toHaveText("78%");
    await expect(previewS2).toHaveText("100%");
    await expect(previewTotal).toHaveText("90%");
    await expect(previewS2Block).toHaveCSS("opacity", "1");

    // --- B. Canal Mails Wise ---
    const wiseEmailBtn = page.locator('.channel-btn[data-channel="wise_email"]');
    await wiseEmailBtn.click();

    // Verificar etiqueta ¿Se generó ticket? en mails
    const emailToggleLabel = page.locator('#channel-checklist-wise_email label:has(#toggle-applies-mda) span');
    await expect(emailToggleLabel).toHaveText("¿Se generó ticket?");

    // Verificar que no existe reclamo/novedad en mails
    await expect(page.locator('input[name="email_mda_reclamo_novedad"]')).not.toBeAttached();

    // Cerrar modal
    await page.locator("#btn-close-modal").click();
    await expect(modal).not.toHaveAttribute("open", "");
  });

  test("Debe mostrar scores consistentes entre la card de auditoría guardada y el modal de edición", async ({
    page,
  }) => {
    await page.goto("/supervision/calidad-operadores");

    const operatorItems = page.locator(".operator-item");
    await expect(operatorItems.first()).toBeVisible({ timeout: 10000 });

    // Buscar operador con llamadas (ej. el que tiene auditorías guardadas)
    let targetOp = operatorItems.first();
    const count = await operatorItems.count();
    for (let i = 0; i < count; i++) {
      const text = await operatorItems.nth(i).innerText();
      if (text.includes("auditoría") || text.includes("Auditoría") || text.includes("534787")) {
        targetOp = operatorItems.nth(i);
        break;
      }
    }
    await targetOp.click();

    // Esperar a que se rendericen las cards
    const callCard = page.locator(".call-card-container").first();
    if (await callCard.isVisible()) {
      // Expandir la card
      const expandBtn = callCard.locator('button[title="Expandir / Minimizar detalles"]');
      await expandBtn.click();

      const details = callCard.locator(".call-card-details");
      await expect(details).toBeVisible();

      // Card scores
      const s1Text = await details.locator("span.text-xl").first().innerText();
      const s2Text = await details.locator("span.text-xl").nth(1).innerText();
      const totalBadge = await callCard.locator(".badge").first().innerText();

      // Verificar que los parámetros de Sección 2 no estén vacíos
      const s2Items = details.locator("div.p-6 ul li");
      const s2Count = await s2Items.count();
      expect(s2Count).toBeGreaterThan(0);

      // Abrir modal de edición
      const editBtn = callCard.locator(".edit-audit-btn");
      if (await editBtn.isVisible()) {
        await editBtn.click();

        const modal = page.locator("#audit-modal");
        await expect(modal).toHaveAttribute("open", "");

        const previewS1 = await page.locator("#preview-s1").innerText();
        const previewS2 = await page.locator("#preview-s2").innerText();
        const previewTotal = await page.locator("#preview-total").innerText();

        // Paridad entre la card y el modal
        expect(previewS1).toBe(`${s1Text}%`);
        expect(previewS2).toBe(`${s2Text}%`);
        expect(totalBadge).toContain(previewTotal.replace("%", ""));

        await page.locator("#btn-close-modal").click();
      }
    }
  });
});

