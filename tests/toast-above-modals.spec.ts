import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

const VIEWPORT = { width: 1280, height: 800 };

async function login(page: Page, context: any, role = "admin") {
  const user = await createTestUserAndSession(role);
  await setSessionCookie(context, user.signedSessionId);
  await page.setViewportSize(VIEWPORT);
  await page.goto("/oficinas");
  await page.locator("main .action-buttons").first().waitFor({ timeout: 20000 });
  return user;
}

async function openFeedbackModal(page: Page) {
  await page.locator("header .dropdown.dropdown-end > [role='button']").click();
  await page
    .locator("header .dropdown-content")
    .getByRole("button", { name: "Enviar sugerencia" })
    .click();
  await page.locator("#feedback_modal .modal-box").waitFor({ state: "visible" });
}

/** El hit test usa la transformacion del ultimo frame pintado: hay que dejar
 * terminar la animacion de entrada (0.3s) antes de medir. */
async function settleAnimations(page: Page) {
  await page.waitForTimeout(600);
}

async function fireToast(page: Page, message: string) {
  await page.evaluate((msg) => {
    (window as any).showToast(msg, "alert-success", 15000);
  }, message);
  const toast = page.locator("#global-toast-container .alert").last();
  await toast.waitFor({ state: "visible" });
  await settleAnimations(page);
  return toast;
}

async function toastHit(page: Page) {
  return page.evaluate(
    `(() => {
      const toast = document.querySelector('#global-toast-container .alert');
      if (!toast) return null;
      const r = toast.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
        return { inToast: false, offScreen: true, text: '' };
      }
      const el = document.elementFromPoint(x, y);
      return {
        inToast: Boolean(el && el.closest('#global-toast-container')),
        inDialog: Boolean(el && el.closest('dialog[open]')),
        offScreen: false,
        text: el ? (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) : null,
      };
    })()`,
  );
}

async function containerParentTag(page: Page) {
  return page.evaluate(
    () => document.getElementById("global-toast-container")!.parentElement!.tagName,
  );
}

test.describe("capa de notificaciones", () => {
  test("usa el z-index máximo de página y no bloquea los clics", async ({
    page,
    context,
  }) => {
    const user = await login(page, context);

    const style = await page.evaluate(
      () =>
        getComputedStyle(document.getElementById("global-toast-container")!),
    );
    expect(Number(style.zIndex)).toBe(2147483647);
    expect(style.pointerEvents).toBe("none");
    expect(await containerParentTag(page)).toBe("BODY");

    await fireToast(page, "Notificación pasiva");
    const hit = await page.evaluate(
      `(() => {
        const c = document.getElementById('global-toast-container');
        const toast = c.querySelector('.alert');
        const tr = toast.getBoundingClientRect();
        const cr = c.getBoundingClientRect();
        const onToast = document.elementFromPoint(
          tr.x + tr.width / 2,
          tr.y + tr.height / 2,
        );
        const outside = document.elementFromPoint(
          cr.x - 8,
          cr.y + cr.height - 4,
        );
        return {
          onToast: Boolean(onToast && c.contains(onToast)),
          outsideFree: Boolean(outside && !c.contains(outside)),
        };
      })()`,
    );
    expect(hit.onToast, "el toast no es clickeable").toBe(true);
    expect(hit.outsideFree, "el área del toast intercepta clics").toBe(true);

    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("queda por encima de un modal nativo abierto", async ({
    page,
    context,
  }) => {
    const user = await login(page, context);

    await openFeedbackModal(page);
    await fireToast(page, "Notificación sobre el modal");

    await expect
      .poll(() => containerParentTag(page), { timeout: 5000 })
      .toBe("DIALOG");

    const top = await toastHit(page);
    expect(top, "no se pudo medir el toast").not.toBeNull();
    expect(
      top!.inToast,
      `el modal tapó el toast (elemento superior: "${top!.text}")`,
    ).toBe(true);

    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("vuelve al body y al primer plano al cerrar el modal", async ({
    page,
    context,
  }) => {
    const user = await login(page, context);

    await openFeedbackModal(page);
    await fireToast(page, "Notificación persistente");

    await page.keyboard.press("Escape");
    await expect(page.locator("#feedback_modal")).toBeHidden();
    await expect
      .poll(() => containerParentTag(page), { timeout: 5000 })
      .toBe("BODY");
    await settleAnimations(page);

    const top = await toastHit(page);
    expect(top!.inToast, "el toast quedó oculto tras cerrar el modal").toBe(true);

    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("sigue por encima cuando se apila un segundo modal", async ({
    page,
    context,
  }) => {
    const user = await login(page, context);

    await openFeedbackModal(page);
    await fireToast(page, "Notificación persistente");

    await page.evaluate(() => {
      const extra = document.createElement("dialog");
      extra.id = "second-modal";
      extra.className = "modal modal-open";
      extra.innerHTML = `<div class="modal-box">Segundo modal</div>`;
      document.body.appendChild(extra);
      extra.showModal();
    });
    await page.locator("#second-modal").waitFor({ state: "visible" });

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.getElementById("global-toast-container")!.parentElement!
                .id,
          ),
        { timeout: 5000 },
      )
      .toBe("second-modal");
    await settleAnimations(page);

    const top = await toastHit(page);
    expect(top!.inToast, "el segundo modal tapó el toast").toBe(true);

    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("supera cualquier z-index de página con el modal abierto", async ({
    page,
    context,
  }) => {
    const user = await login(page, context);

    await openFeedbackModal(page);
    await fireToast(page, "Notificación sobre probe");

    await page.evaluate(
      `(() => {
        const toast = document.querySelector('#global-toast-container .alert');
        const r = toast.getBoundingClientRect();
        const probe = document.createElement('div');
        probe.id = 'z-probe';
        probe.style.cssText =
          'position:fixed;left:' + (r.x - 40) + 'px;top:' + (r.y - 20) +
          'px;width:80px;height:40px;z-index:2147483646;background:transparent';
        document.body.appendChild(probe);
      })()`,
    );

    const top = await toastHit(page);
    expect(top!.inToast, "un z-index altísimo tapó el toast").toBe(true);

    await page.evaluate(() => document.getElementById("z-probe")?.remove());
    await cleanupTestUser(user.userId, user.sessionId);
  });
});
