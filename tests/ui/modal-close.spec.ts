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

async function gotoCronograma(page: Page, context: BrowserContext) {
  await setSessionCookie(context, signedSessionId);
  await page.goto("/supervision/cronograma");
  await page.waitForSelector("#monthly-table");
}

async function gotoCronogramaEditMode(page: Page, context: BrowserContext) {
  await gotoCronograma(page, context);
  await page.click("#toggle-edit-mode-btn");
  await expect(page.locator("#open-rules-settings")).toBeVisible();
}

async function clickBackdrop(page: Page, dialogId: string) {
  const backdrop = page.locator(`#${dialogId} > .modal-backdrop`);
  await expect(backdrop).toHaveCount(1);
  await backdrop.click({ position: { x: 6, y: 6 } });
}

async function openFeedbackModal(page: Page, context: BrowserContext) {
  await setSessionCookie(context, signedSessionId);
  await page.goto("/supervision/cronograma");
  await page.locator(".dropdown > [role='button']").first().click();
  await page.locator("[data-open-feedback-modal]").click();
  await expect(page.locator("#feedback_modal")).toBeVisible();
}

test.describe("Modales: cierre al clickear fuera", () => {
  test("feriados cierra al clickear fuera", async ({ context, page }) => {
    await gotoCronogramaEditMode(page, context);
    await page.click("#open-holidays-modal");
    await expect(page.locator("#holidays-modal")).toBeVisible();

    await clickBackdrop(page, "holidays-modal");

    await expect(page.locator("#holidays-modal")).toBeHidden();
  });

  test("nuevo mes cierra al clickear fuera", async ({ context, page }) => {
    await gotoCronogramaEditMode(page, context);
    await page.click("#add-month-btn");
    await expect(page.locator("#new-month-modal")).toBeVisible();

    await clickBackdrop(page, "new-month-modal");

    await expect(page.locator("#new-month-modal")).toBeHidden();
  });

  test("reglas de cronograma cierra al clickear fuera", async ({
    context,
    page,
  }) => {
    await gotoCronogramaEditMode(page, context);
    await page.click("#open-rules-settings");
    await expect(page.locator("#rules-settings-modal")).toBeVisible();

    await clickBackdrop(page, "rules-settings-modal");

    await expect(page.locator("#rules-settings-modal")).toBeHidden();
  });

  test("feedback cierra al clickear fuera", async ({ context, page }) => {
    await openFeedbackModal(page, context);

    await clickBackdrop(page, "feedback_modal");

    await expect(page.locator("#feedback_modal")).toBeHidden();
  });

  test("dialog propio de oficinas cierra al clickear fuera", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, signedSessionId);
    await page.goto("/admin/invgate/ubicaciones");
    await expect(page.locator("#create_office_modal")).toBeAttached();
    await page.evaluate(() => {
      const dialog = document.getElementById("create_office_modal");
      if (dialog instanceof HTMLDialogElement) dialog.showModal();
    });
    await expect(page.locator("#create_office_modal")).toBeVisible();

    await clickBackdrop(page, "create_office_modal");

    await expect(page.locator("#create_office_modal")).toBeHidden();
  });

  test("cancelar de oficinas sin ícono y sin cruz en el header", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, signedSessionId);
    await page.goto("/admin/invgate/ubicaciones");
    await expect(page.locator("#create_office_modal")).toBeAttached();
    await page.evaluate(() => {
      const dialog = document.getElementById("create_office_modal");
      if (dialog instanceof HTMLDialogElement) dialog.showModal();
    });
    await expect(page.locator("#create_office_modal")).toBeVisible();

    await expect(
      page.locator("#create_office_modal button", { hasText: /^Cancelar$/ }).locator("svg"),
    ).toHaveCount(0);
    await expect(
      page.locator("#create_office_modal .modal-box button.btn-circle"),
    ).toHaveCount(0);
  });

  test("click dentro del modal no lo cierra", async ({ context, page }) => {
    await gotoCronogramaEditMode(page, context);
    await page.click("#open-holidays-modal");
    await expect(page.locator("#holidays-modal")).toBeVisible();

    await page.locator("#holidays-modal .modal-box").click();

    await expect(page.locator("#holidays-modal")).toBeVisible();
  });
});

test.describe("Modales: botón cancelar sin ícono", () => {
  const cases = [
    {
      open: "#open-holidays-modal",
      dialog: "#holidays-modal",
      cancel: "#cancel-holidays-btn",
    },
    {
      open: "#add-month-btn",
      dialog: "#new-month-modal",
      cancel: "#cancel-new-month",
    },
    {
      open: "#open-rules-settings",
      dialog: "#rules-settings-modal",
      cancel: "#rules-settings-modal button.btn-error",
    },
  ];

  for (const c of cases) {
    test(`cancelar sin ícono en ${c.dialog}`, async ({ context, page }) => {
      await gotoCronogramaEditMode(page, context);
      await page.click(c.open);
      await expect(page.locator(c.dialog)).toBeVisible();

      const cancelButton = page.locator(c.cancel);
      await expect(cancelButton).toBeVisible();
      await expect(cancelButton).toHaveText("Cancelar");
      await expect(cancelButton.locator("svg")).toHaveCount(0);
    });
  }

  test("cancelar de feedback sin ícono", async ({ context, page }) => {
    await openFeedbackModal(page, context);
    const cancelButton = page.locator(
      "#feedback_modal button[data-close-feedback-modal]",
    );
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toHaveText("Cancelar");
    await expect(cancelButton.locator("svg")).toHaveCount(0);
  });
});

test.describe("Modales: sin cruz en el header cuando hay cancelar", () => {
  test("feedback no tiene botón de cerrar en el header", async ({
    context,
    page,
  }) => {
    await openFeedbackModal(page, context);

    await expect(
      page.locator("#feedback_modal .modal-box button.btn-circle"),
    ).toHaveCount(0);
    await expect(
      page.locator('#feedback_modal button[aria-label="Cerrar modal"]'),
    ).toHaveCount(0);
  });

  test("cancelar de feedback sigue cerrando el modal", async ({
    context,
    page,
  }) => {
    await openFeedbackModal(page, context);
    await page.click(
      "#feedback_modal button[data-close-feedback-modal]",
    );
    await expect(page.locator("#feedback_modal")).toBeHidden();
  });
});

test.describe("Modales: notificaciones por encima del backdrop", () => {
  test("toast visible con el modal abierto", async ({ context, page }) => {
    await gotoCronogramaEditMode(page, context);
    await page.click("#open-holidays-modal");
    await expect(page.locator("#holidays-modal")).toBeVisible();

    await page.evaluate(() => {
      (window as any).showToast("Prueba de toast", "alert-success");
    });

    await expect(page.locator("#global-toast-container .alert")).toBeVisible();
  });
});
