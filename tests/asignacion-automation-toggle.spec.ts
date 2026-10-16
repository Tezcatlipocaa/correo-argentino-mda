import "dotenv/config";
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { autogestionRuleState, auditLogs, mesas, users } from "../src/db/schema";
import { MDA_TI_HELPDESK } from "../src/lib/helpdeskAccess";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * Toggle de habilitación de automatizaciones de AGS:
 * - Mutación: referent+ (requireWriteAccess del módulo asignacion_ag).
 * - El estado persiste en `autogestion_rule_state` y queda auditado.
 * - CSRF obligatorio en el POST.
 */

const RULE_ID = "solicitud_rechazada";
const TOGGLE_PATH = `/api/autogestion/rules/${RULE_ID}/toggle`;

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let supervisorUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let referentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

async function clearRuleState() {
  await db.delete(autogestionRuleState);
}

async function readRuleEnabled(): Promise<boolean | null> {
  const [row] = await db
    .select({ enabled: autogestionRuleState.enabled })
    .from(autogestionRuleState)
    .where(eq(autogestionRuleState.ruleId, RULE_ID));
  return row ? Boolean(row.enabled) : null;
}

async function auditRowsForUser(username: string) {
  return db
    .select({ action: auditLogs.action, entityType: auditLogs.entityType })
    .from(auditLogs)
    .where(eq(auditLogs.username, username));
}

/** El CSRF se valida contra la sesión: hay que leerlo de una página real. */
async function csrfFromPage(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/supervision/asignacion-autogestiones");
  const token = await page
    .locator("#panel-automatizacion")
    .getAttribute("data-csrf-token");
  expect(token).toBeTruthy();
  return token as string;
}

/**
 * El panel arranca oculto salvo que initialTab sea "automatizacion", y el query
 * param no llega al server island (ver AGENTS.md: hay que usar
 * getResolvedSearchParams). Por eso el test abre la pestaña como el usuario.
 */
async function openAutomationTab(page: import("@playwright/test").Page) {
  await page.goto("/supervision/asignacion-autogestiones");
  await page.locator("#tab-btn-automatizacion").click();
  await expect(page.locator("#panel-automatizacion")).toBeVisible();
}

/**
 * La página /supervision/* solo es visible para usuarios de la mesa MDA TI
 * (isSectionVisibleSync). Los usuarios de test nacen sin mesa, así que hay que
 * asignársela o el middleware los rebota a /?toast_msg=Acceso no autorizado.
 */
async function assignMdaTiMesa(user: { userId: number }) {
  const [mesa] = await db
    .select({ invgateId: mesas.invgateId })
    .from(mesas)
    .where(eq(mesas.name, MDA_TI_HELPDESK));
  await db
    .update(users)
    .set({ helpdeskId: mesa?.invgateId ?? null, helpdeskName: MDA_TI_HELPDESK })
    .where(eq(users.id, user.userId));
}

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
  supervisorUser = await createTestUserAndSession("supervisor");
  referentUser = await createTestUserAndSession("referent");
  await assignMdaTiMesa(agentUser);
  await assignMdaTiMesa(supervisorUser);
  await assignMdaTiMesa(referentUser);
});

test.afterAll(async () => {
  await clearRuleState();
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
  await cleanupTestUser(supervisorUser.userId, supervisorUser.sessionId);
  await cleanupTestUser(referentUser.userId, referentUser.sessionId);
});

test.describe("Toggle de automatizaciones AGS", () => {
  test.beforeEach(async () => {
    await clearRuleState();
  });

  test("un agent no puede togglear la automatización", async ({ context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const res = await context.request.post(TOGGLE_PATH, { data: { enabled: false } });

    expect(res.status()).toBe(403);
    expect(await readRuleEnabled()).toBeNull();
  });

  test("un agent no ve los controles de toggle en la UI", async ({ page, context }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await openAutomationTab(page);

    await expect(page.locator("[data-rule-toggle]")).toHaveCount(0);
    // El estado sigue visible, solo sin controles.
    await expect(page.locator("[data-rule-badge]").first()).toBeVisible();
  });

  test("un supervisor deshabilita y vuelve a habilitar, persistiendo y auditando", async ({
    page,
    context,
  }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);
    const csrf = await csrfFromPage(page);

    const off = await context.request.post(TOGGLE_PATH, {
      headers: { "X-CSRF-Token": csrf },
      data: { enabled: false },
    });
    expect(off.status()).toBe(200);
    expect((await off.json()).previous).toBe(true); // default documental: activa
    expect(await readRuleEnabled()).toBe(false);

    const on = await context.request.post(TOGGLE_PATH, {
      headers: { "X-CSRF-Token": csrf },
      data: { enabled: true },
    });
    expect(on.status()).toBe(200);
    expect(await readRuleEnabled()).toBe(true);

    const rows = await auditRowsForUser(supervisorUser.username);
    const toggleRows = rows.filter((r) => r.entityType === "autogestion_rule");
    expect(toggleRows.length).toBe(2);
    expect(toggleRows.some((r) => r.action.includes("Deshabilitó"))).toBe(true);
    expect(toggleRows.some((r) => r.action.includes("Habilitó"))).toBe(true);
  });

  test("un referente también puede togglear", async ({ page, context }) => {
    await setSessionCookie(context, referentUser.signedSessionId);
    const csrf = await csrfFromPage(page);

    const res = await context.request.post(TOGGLE_PATH, {
      headers: { "X-CSRF-Token": csrf },
      data: { enabled: false },
    });

    expect(res.status()).toBe(200);
    expect(await readRuleEnabled()).toBe(false);
  });

  test("sin token CSRF la mutación se rechaza", async ({ context }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);

    const res = await context.request.post(TOGGLE_PATH, { data: { enabled: false } });

    expect(res.status()).toBe(403);
    expect(await readRuleEnabled()).toBeNull();
  });

  test("una regla inexistente devuelve 404", async ({ page, context }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);
    const csrf = await csrfFromPage(page);

    const res = await context.request.post("/api/autogestion/rules/inexistente/toggle", {
      headers: { "X-CSRF-Token": csrf },
      data: { enabled: false },
    });

    expect(res.status()).toBe(404);
  });

  test("el toggle de la UI refresca estado, badge y contador", async ({ page, context }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);
    await openAutomationTab(page);

    const toggle = page.locator(`[data-rule-toggle="${RULE_ID}"]`);
    const badge = page.locator(`[data-rule-badge="${RULE_ID}"]`);
    const counter = page.locator("#automation-active-count");

    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();
    await expect(badge).toHaveText("Activa");

    // Apagar: el switch queda desmarcado, el badge en Inactiva y el contador baja.
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await expect(badge).toHaveText("Inactiva");
    await expect(counter).toHaveText("1 activa");
    expect(await readRuleEnabled()).toBe(false);

    // Todo el apagado visual cuelga de data-off en la card (sin recargar).
    const card = page.locator(`[data-rule-card="${RULE_ID}"]`);
    const title = card.getByText("Devolución de Solicitudes Rechazadas");
    const colorApagada = await title.evaluate((el) => getComputedStyle(el).color);
    await expect(card).toHaveAttribute("data-off", "true");
    // La información sigue legible.
    await expect(title).toBeVisible();

    // Encender de nuevo: el estado visual vuelve sin tocar la base.
    await toggle.check();
    await expect(badge).toHaveText("Activa");
    await expect(counter).toHaveText("2 activas");
    expect(await readRuleEnabled()).toBe(true);
    const colorEncendida = await title.evaluate((el) => getComputedStyle(el).color);
    expect(colorEncendida).not.toBe(colorApagada);
    await expect(card).not.toHaveAttribute("data-off", "true");
  });
});
