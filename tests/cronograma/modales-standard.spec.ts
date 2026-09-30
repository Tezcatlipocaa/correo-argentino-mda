import "dotenv/config";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "../helpers/auth";

let userId: number;
let sessionId: string;
let signedSessionId: string;

test.beforeAll(async () => {
  const user = await createTestUserAndSession("admin");
  userId = user.userId;
  sessionId = user.sessionId;
  signedSessionId = user.signedSessionId;
});

test.afterAll(async () => {
  await cleanupTestUser(userId, sessionId);
});

async function gotoEditMode(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  await setSessionCookie(context, signedSessionId);
  await page.goto("/supervision/cronograma");
  await page.waitForSelector("#monthly-table");
  await page.click("#toggle-edit-mode-btn");
  await expect(page.locator("#open-rules-settings")).toBeVisible();
}

test.describe("Cronograma: modales estándar", () => {
  test("Parámetros no desborda horizontalmente en mobile", async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoEditMode(page, context);

    await page.click("#open-rules-settings");
    const box = page.locator("#rules-settings-modal .modal-box");
    await expect(box).toBeVisible();

    const [scrollWidth, clientWidth] = await box.evaluate((el) => [
      el.scrollWidth,
      el.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("Feriados usa botones estándar de cancelar y guardar", async ({
    context,
    page,
  }) => {
    await gotoEditMode(page, context);

    await page.click("#open-holidays-modal");
    await expect(page.locator("#holidays-modal")).toBeVisible();

    await expect(page.locator("#cancel-holidays-btn")).toHaveClass(/btn-soft/);
    await expect(page.locator("#cancel-holidays-btn")).toHaveClass(/btn-error/);
    await expect(page.locator("#save-holidays-btn")).toHaveClass(
      /btn-secondary/,
    );
    await expect(page.locator("#save-holidays-btn svg")).toBeVisible();
  });

  test("Nuevo mes abre y cancela con dialog estándar", async ({
    context,
    page,
  }) => {
    await gotoEditMode(page, context);

    await page.click("#add-month-btn");
    await expect(page.locator("#new-month-modal")).toBeVisible();
    await page.click("#cancel-new-month");
    await expect(page.locator("#new-month-modal")).toBeHidden();
  });

  test("Horario sábado está integrado al Modal estándar", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, signedSessionId);
    await page.goto("/supervision/cronograma");
    await page.waitForSelector("#monthly-table");

    await expect(page.locator("#edit-saturday-schedule-modal")).toHaveJSProperty(
      "tagName",
      "DIALOG",
    );
    await expect(page.locator("#saturday-schedule-save-btn")).toHaveAttribute(
      "form",
      "edit-saturday-schedule-form",
    );
    await expect(page.locator("#modal-schedule-start")).toHaveClass(/input-sm/);
  });
});
