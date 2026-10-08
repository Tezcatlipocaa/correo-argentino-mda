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

    // Verificar que los botones de búsqueda tienen SVG con path renderizado (is:inline)
    const wiseSvgPath = page.locator("#btn-fetch-wise-api svg path");
    await expect(wiseSvgPath).toBeVisible();

    // 1. Los campos de búsqueda están unificados en "Datos de la atención"
    // (no existe la tarjeta #unified-search-card ni sus tabs duplicados)
    await expect(page.locator("#unified-search-card")).not.toBeAttached();
    await expect(page.locator("#tab-search-wise")).not.toBeAttached();
    await expect(page.locator("#tab-search-invgate")).not.toBeAttached();

    const callIdInput = page.locator("#form-call-id");
    const ticketIdInput = page.locator("#form-ticket-id");
    const btnFetchWise = page.locator("#btn-fetch-wise-api");
    const btnFetchInvgate = page.locator("#btn-fetch-invgate-api");

    await expect(callIdInput).toBeVisible();
    await expect(ticketIdInput).toBeVisible();
    await expect(btnFetchWise).toBeVisible();
    await expect(btnFetchInvgate).toBeVisible();
    await expect(page.locator("#btn-fetch-invgate-label")).toHaveText("Buscar");

    // 2. Ambos botones siguen disponibles en Autogestión (ya no hay tabs que oculten)
    const agBtn = page.locator('.channel-btn[data-channel="invgate_ticket"]');
    await agBtn.click();
    await expect(btnFetchWise).toBeVisible();
    await expect(btnFetchInvgate).toBeVisible();

    // Volver a canal Llamada Wise
    const callBtn = page.locator('.channel-btn[data-channel="wise_call"]');
    await callBtn.click();
    await expect(btnFetchWise).toBeVisible();

    // 2b. El deep-link a InvGate arranca deshabilitado sin ticket cargado
    const btnOpenInvgate = page.locator("#btn-open-invgate-ticket");
    await expect(btnOpenInvgate).toHaveClass(/pointer-events-none/);

    // 3. Probar que al buscar en Wise CX NO se llena el Detalle del Ticket y el audio es independiente
    await page.route("**/api/calidad/fetch-metadata*source=wise*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            caseNumber: "534787",
            operator: "Juan Pérez",
            duration: "03:45",
            date: "2026-10-02",
            recordingUrl: "https://example.com/recordings/call-534787.mp3",
          },
        }),
      });
    });

    await callIdInput.fill("534787");
    await btnFetchWise.click();

    // Detalle del Ticket NO debe haberse cargado desde Wise
    const tvTitlePre = page.locator("#tv-title");
    await expect(tvTitlePre).toHaveText("-");
    await expect(page.locator("#tv-category")).toHaveText("-");
    await expect(page.locator("#ticket-viewer-badge")).toHaveText("Sin ticket cargado");

    // Pero el reproductor de audio independiente sí debe mostrarse
    const audioContainer = page.locator("#tv-audio-container");
    await expect(audioContainer).toBeVisible();
    await expect(page.locator("#tv-audio-download")).toHaveAttribute("href", /api\/calidad\/download-audio.*call-534787\.mp3/);

    // 4. Verificar acordeón del visor de ticket en vivo (InvGate)
    const tvHeader = page.locator("#ticket-viewer-header");
    const tvContent = page.locator("#ticket-viewer-content");
    await expect(tvContent).toHaveClass(/hidden/);
    await tvHeader.click();
    await expect(tvContent).not.toHaveClass(/hidden/);

    // 5. Verificar que Falla Crítica de Proceso no existe en el modal
    await expect(page.locator("#form-is-critical-failure")).not.toBeAttached();

    // 6. Mockear respuesta de InvGate con HTML en descripción y título homologado
    let mockTitle = "Aforadora- Consulta";
    let mockSource = "Teléfono";
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
            helpdesk: "Mesa de Ayuda TI",
            source: mockSource,
            description: "<p>Falla en equipo aforadora <strong>sucursal</strong>.<br>No imprime comprobante.</p>",
            date: "2026-10-01",
          },
        }),
      });
    });

    // Buscar en InvGate desde el campo #form-ticket-id
    await ticketIdInput.fill("88442");
    await btnFetchInvgate.click();

    // 6. Verificar que el visor de ticket se actualizó y la descripción no tiene tags HTML
    const tvTitle = page.locator("#tv-title");
    await expect(tvTitle).toHaveText("Aforadora- Consulta");
    await expect(page.locator("#tv-category")).toHaveText("Hardware");
    await expect(page.locator("#tv-priority")).toHaveText("Alta");
    await expect(page.locator("#tv-creator")).toHaveText("Juan Pérez");
    await expect(page.locator("#tv-helpdesk")).toHaveText("Mesa de Ayuda TI");
    await expect(page.locator("#tv-source")).toHaveText("Teléfono");

    const tvDescription = page.locator("#tv-description");
    await expect(tvDescription).toContainText("Falla en equipo aforadora sucursal.");
    await expect(tvDescription).not.toContainText("<p>");
    await expect(tvDescription).not.toContainText("<strong>");
    await expect(tvDescription).not.toContainText("<br>");

    // 7. Verificar auto-evaluación asistida del parámetro Título y Origen (Ambos válidos)
    const tvTitleBadge = page.locator("#tv-title-match-badge");
    await expect(tvTitleBadge).toContainText("Título Homologado");

    const titleCheckbox = page.locator('input[name="call_ticket_titulo"]');
    await expect(titleCheckbox).toBeChecked();

    const titleRuleBadge = page.locator('.rule-auto-badge[data-rule-badge="call_ticket_titulo"]');
    await expect(titleRuleBadge).toHaveClass(/hidden/);

    const sourceCheckbox = page.locator('input[name="call_ticket_origen"]');
    await expect(sourceCheckbox).toBeChecked();

    const sourceRuleBadge = page.locator('.rule-auto-badge[data-rule-badge="call_ticket_origen"]');
    await expect(sourceRuleBadge).toHaveClass(/hidden/);

    // 8. Probar búsqueda con Título No Homologado y Origen No Válido (ej: Correo en llamada wise)
    mockTitle = "Titulo Inexistente No Homologado 999";
    mockSource = "Correo";
    await ticketIdInput.fill("88443");
    await btnFetchInvgate.click();

    // Verificar que badge dice "No Homologado" sin símbolo ⚠
    await expect(tvTitleBadge).toHaveText("No Homologado");
    await expect(tvTitleBadge).not.toContainText("⚠");

    // Verificar que el checkbox de título se desmarca y aparece el badge de "Desactivado por regla"
    await expect(titleCheckbox).not.toBeChecked();
    await expect(titleRuleBadge).not.toHaveClass(/hidden/);
    await expect(titleRuleBadge).toHaveText("Desactivado por regla");

    // Verificar que el checkbox de origen se desmarca y muestra advertencia de regla
    await expect(sourceCheckbox).not.toBeChecked();
    await expect(sourceRuleBadge).not.toHaveClass(/hidden/);
    await expect(sourceRuleBadge).toHaveText("Origen incorrecto");

    // 9. Verificar que si el usuario activa manualmente el checkbox, el badge de regla se oculta
    await titleCheckbox.check();
    await expect(titleCheckbox).toBeChecked();
    await expect(titleRuleBadge).toHaveClass(/hidden/);

    await sourceCheckbox.check();
    await expect(sourceCheckbox).toBeChecked();
    await expect(sourceRuleBadge).toHaveClass(/hidden/);

    // 10. Verificar que el número de ticket se asignó en el formulario
    await expect(page.locator("#form-ticket-id")).toHaveValue("88442");

    // 10b. El badge no debe desbordar su caja ni perder el shrink-0 al
    // cambiar de estado (regresión: el JS pisaba el className completo)
    const viewerBadge = page.locator("#ticket-viewer-badge");
    await expect(viewerBadge).toContainText("88442");
    await expect(viewerBadge).toHaveClass(/shrink-0/);
    await expect(viewerBadge).toHaveClass(/badge-neutral/);
    await expect(viewerBadge).not.toHaveClass(/badge-primary/);
    const badgeBox = await viewerBadge.boundingBox();
    if (badgeBox) {
      // El texto debe caber dentro del ancho del badge
      const textWidth = await viewerBadge.evaluate(
        (el) => el.scrollWidth,
      );
      expect(textWidth).toBeLessThanOrEqual(Math.ceil(badgeBox.width) + 1);
    }

    // 11. El deep-link a InvGate apunta al ticket cargado y abre en pestaña nueva
    await expect(btnOpenInvgate).not.toHaveClass(/pointer-events-none/);
    await expect(btnOpenInvgate).toHaveAttribute("target", "_blank");
    await expect(btnOpenInvgate).toHaveAttribute("rel", /noopener/);
    await expect(btnOpenInvgate).toHaveAttribute(
      "href",
      /\/requests\/show\/index\/id\/88442$/,
    );

    // 12. Enter en el campo dispara la búsqueda (mismo resultado que el botón).
    // El mock responde con caseNumber fijo "88442", así que el input se
    // resincroniza a ese valor y el deep-link debe reflejarlo.
    mockTitle = "Titulo Cargado Mediante Enter";
    mockSource = "Teléfono";
    await ticketIdInput.fill("88450");
    await ticketIdInput.press("Enter");
    await expect(tvTitle).toHaveText("Titulo Cargado Mediante Enter");
    await expect(ticketIdInput).toHaveValue("88442");
    await expect(btnOpenInvgate).toHaveAttribute(
      "href",
      /\/requests\/show\/index\/id\/88442$/,
    );

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

    // Con sección 2 desactivada: S2 = N/A, S1 = 100%, Total = 100% (solo puntúa S1)
    await expect(previewS1).toHaveText("100%");
    await expect(previewS2).toHaveText("N/A");
    await expect(previewTotal).toHaveText("100%");
    await expect(previewS2Block).toHaveCSS("opacity", "0.3");

    // Desmarcar un ítem de sección 1: Cumplimiento de procedimiento (-10%)
    // Base 45: 35/45 = 78%
    const procCheckbox = page.locator('input[name="call_procedimiento"]');
    await procCheckbox.uncheck();
    await expect(previewS1).toHaveText("78%");
    await expect(previewS2).toHaveText("N/A");
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

  test("Debe presentar el modal en 2 columnas con notas bajo demanda y score N/A para ticket excluido", async ({ page }) => {
    await page.goto("/supervision/calidad-operadores");
    const operatorItems = page.locator(".operator-item");
    await expect(operatorItems.first()).toBeVisible({ timeout: 10000 });
    await operatorItems.first().click();

    const btnNewAudit = page.locator("#btn-new-audit");
    await btnNewAudit.click();

    const modal = page.locator("#audit-modal");
    await expect(modal).toHaveAttribute("open", "");

    // 1. Layout de 2 columnas
    const gridContainer = page.locator("#modal-grid-container");
    const colContext = page.locator("#modal-grid-context");
    const colEvaluation = page.locator("#modal-grid-evaluation");
    await expect(gridContainer).toBeVisible();
    await expect(colContext).toBeVisible();
    await expect(colEvaluation).toBeVisible();

    // 2. Revelado progresivo de notas de observación
    const firstCheckItem = page.locator("#channel-checklist-wise_call .checklist-item").first();
    await expect(firstCheckItem).toBeVisible();

    const obsWrapper = firstCheckItem.locator(".criteria-obs-wrapper");
    // Por defecto debe estar oculto
    await expect(obsWrapper).toHaveClass(/hidden/);

    // Al desmarcar el check, el campo de observación debe revelarse automáticamente
    const checkbox = firstCheckItem.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(obsWrapper).not.toHaveClass(/hidden/);

    // Al volver a marcarlo, se oculta o permite abrirse con el botón "+ Observación"
    await checkbox.check();
    await expect(obsWrapper).toHaveClass(/hidden/);

    const toggleObsBtn = firstCheckItem.locator('[data-action="toggle-obs"]');
    await expect(toggleObsBtn).toBeVisible();
    await toggleObsBtn.click();
    await expect(obsWrapper).not.toHaveClass(/hidden/);

    // 3. Score N/A cuando el ticket no aplica
    const ticketToggle = page.locator("#toggle-call-generated-ticket");
    await expect(ticketToggle).toBeChecked();
    await ticketToggle.uncheck();

    const previewS2 = page.locator("#preview-s2");
    await expect(previewS2).toHaveText(/N\/A|Excluido/i);

    const previewTotal = page.locator("#preview-total");
    await expect(previewTotal).toHaveText("100%");

    // Cerrar modal
    await page.locator("#btn-close-modal").click();
    await expect(modal).not.toHaveAttribute("open", "");
  });
});

