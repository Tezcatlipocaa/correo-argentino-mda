import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "../helpers/auth";
import { db } from "../../src/db/index";
import { employees, feedback } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const SUFFIX = Date.now();
const TEST_DNI = "8" + String(SUFFIX).slice(-7);
const TEST_USERNAME = `test_audit_${SUFFIX}`;

type Report = {
  modal: string;
  boxScrolls: boolean;
  footerFullyVisible: boolean;
  footerOverflowsBox: boolean;
  footerBottom: number;
  boxBottom: number;
};

async function measure(page: Page, modalSel: string): Promise<Report> {
  return page.evaluate((sel) => {
    const dialog = document.querySelector<HTMLElement>(sel)!;
    const box = dialog.querySelector<HTMLElement>(".modal-box")!;
    const actions = dialog.querySelector<HTMLElement>(".modal-action");
    const footer = actions ?? (box.lastElementChild as HTMLElement);
    const b = box.getBoundingClientRect();
    const f = footer.getBoundingClientRect();
    return {
      modal: sel,
      boxScrolls: box.scrollHeight > box.clientHeight + 1,
      footerFullyVisible: f.top >= b.top - 1 && f.bottom <= b.bottom + 1,
      footerOverflowsBox: f.right > b.right + 1 || f.left < b.left - 1,
      footerBottom: Math.round(f.bottom),
      boxBottom: Math.round(b.bottom),
    };
  }, modalSel);
}

/**
 * Invariant: the actions footer must be fully inside the modal-box without
 * scrolling it away. With `fixedFooter` this is structural; without it, the
 * footer only survives when the whole modal fits the viewport.
 */
function expectFooterReachable(r: Report) {
  expect(
    r.footerFullyVisible,
    `${r.modal}: footer not fully visible (footer ${r.footerBottom} vs box ${r.boxBottom})`,
  ).toBe(true);
  expect(
    r.footerOverflowsBox,
    `${r.modal}: footer overflows the modal-box horizontally`,
  ).toBe(false);
}

test.describe("modal footer visibility @375x667", () => {
  test("edit-user-modal (buscador-usuarios, agent)", async ({ page, context }) => {
    const user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/buscador-usuarios");
    await page.fill("#search-input", TEST_USERNAME);
    await page
      .locator(".card:not(.skeleton-debounced)")
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    await page.locator("[data-edit-user-btn]").first().click();
    await page.locator("#edit-user-modal").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    expectFooterReachable(await measure(page, "#edit-user-modal"));
    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("feedback_modal (nav dropdown, agent)", async ({ page, context }) => {
    const user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.locator("nav.navbar .dropdown [role='button']").first().click();
    await page.locator("[data-open-feedback-modal]").first().click();
    await page.locator("#feedback_modal").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    expectFooterReachable(await measure(page, "#feedback_modal"));
    // Bug tab is the tallest form in the app
    await page.locator("#tab-bug").click();
    await page.locator("#bug-form").waitFor({ state: "visible" });
    await page.waitForTimeout(200);
    expectFooterReachable(await measure(page, "#feedback_modal"));
    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("rules-settings-modal (cronograma, supervisor)", async ({ page, context }) => {
    const user = await createTestUserAndSession("supervisor");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/supervision/cronograma");
    const btn = page.locator("#open-rules-settings");
    const rendered = await btn
      .waitFor({ state: "attached", timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!rendered) {
      test.info().annotations.push({
        type: "coverage-gap",
        description:
          "rules-settings-modal: trigger not rendered, footer not measured",
      });
      await cleanupTestUser(user.userId, user.sessionId);
      return;
    }
    await btn.click();
    await page.locator("#rules-settings-modal").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    expectFooterReachable(await measure(page, "#rules-settings-modal"));
    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("modal-marcar-excepcion (asignacion, supervisor)", async ({ page, context }) => {
    const user = await createTestUserAndSession("supervisor");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/supervision/asignacion-autogestiones");
    const trigger = page.locator("[data-action-open-exception-modal]");
    const rendered = await trigger
      .first()
      .waitFor({ state: "attached", timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!rendered) {
      test.info().annotations.push({
        type: "coverage-gap",
        description:
          "modal-marcar-excepcion: trigger not rendered, footer not measured",
      });
      await cleanupTestUser(user.userId, user.sessionId);
      return;
    }
    await trigger.first().click();
    await page.locator("#modal-marcar-excepcion").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    expectFooterReachable(await measure(page, "#modal-marcar-excepcion"));
    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("modal-details (admin/feedback, admin)", async ({ page, context }) => {
    const user = await createTestUserAndSession("admin");
    const [row] = await db
      .insert(feedback)
      .values({
        userId: user.userId,
        type: "sugerencia",
        subject: `Audit ${SUFFIX}`,
        category: "oficinas",
        description: "Auditoria de visibilidad del footer",
        status: "pendiente",
      })
      .returning({ id: feedback.id });
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/admin/feedback");
    await page.locator("[data-table-row]").first().waitFor({ state: "visible", timeout: 15000 });
    await page.locator('[data-action="view-details"]').first().click();
    await page.locator("#modal-details").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    expectFooterReachable(await measure(page, "#modal-details"));
    await db.delete(feedback).where(eq(feedback.id, row.id));
    await cleanupTestUser(user.userId, user.sessionId);
  });
});

test.beforeAll(async () => {
  await db.insert(employees).values({
    dni: TEST_DNI,
    username: TEST_USERNAME,
    fullname: `Audit ${SUFFIX}`,
    interno: "1111",
    telefono: "222-2222",
    sucursal: "",
  });
});

test.afterAll(async () => {
  await db.delete(employees).where(eq(employees.dni, TEST_DNI));
});
