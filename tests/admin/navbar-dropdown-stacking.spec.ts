import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "../helpers/auth";

const VIEWPORT = { width: 1280, height: 800 };

async function openAvatarDropdown(page: Page) {
  await page.locator("header .dropdown.dropdown-end > [role='button']").click();
  const menu = page.locator("header .dropdown-content");
  await expect(menu).toBeVisible();
  return menu;
}

async function headerZ(page: Page) {
  return Number(
    await page.evaluate(
      () => getComputedStyle(document.querySelector("header")!).zIndex,
    ),
  );
}

/** Highest z-index declared by page content inside the scroller, ignoring
 * overlay layers (modals, toasts) that are meant to sit above the navbar. */
async function maxPageZ(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    let max = 0;
    for (const el of Array.from(main.querySelectorAll("*"))) {
      if (el.closest("dialog, .modal, .toast, [popover]")) continue;
      const z = Number(getComputedStyle(el).zIndex);
      if (Number.isFinite(z) && z > max) max = z;
    }
    return max;
  });
}

test.describe("navbar avatar dropdown stacking", () => {
  test("pinta sobre los controles de la página (/oficinas)", async ({
    page,
    context,
  }) => {
    const user = await createTestUserAndSession("admin");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize(VIEWPORT);
    await page.goto("/oficinas");
    await page.locator("main .action-buttons").first().waitFor({ timeout: 20000 });

    const menu = await openAvatarDropdown(page);
    expect(await headerZ(page)).toBeGreaterThan(await maxPageZ(page));

    // Probe: a page-level control with the highest z-index the app uses for
    // content (e.g. the z-50 action buttons on office cards) placed under the
    // dropdown. The navbar layer must win.
    const menuRect = (await menu.boundingBox())!;
    const probeWins = await page.evaluate(
      ({ x, y, w, h }) => {
        const probe = document.createElement("div");
        probe.id = "z-probe";
        probe.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:50`;
        document.querySelector("main")!.appendChild(probe);
        const menu = document.querySelector<HTMLElement>(
          "header .dropdown-content",
        )!;
        const hit = document.elementFromPoint(
          x + w / 2,
          y + h / 2,
        ) as HTMLElement;
        const menuWins = Boolean(hit && menu.contains(hit));
        probe.remove();
        return !menuWins;
      },
      {
        x: menuRect.x,
        y: menuRect.y,
        w: menuRect.width,
        h: menuRect.height,
      },
    );
    expect(
      probeWins,
      "un control de página con z-50 tapó el dropdown del avatar",
    ).toBe(false);

    await expect(menu.getByRole("link", { name: "Ver perfil" })).toBeVisible();
    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("queda por debajo de modales y notificaciones del sistema", async ({
    page,
    context,
  }) => {
    const user = await createTestUserAndSession("admin");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize(VIEWPORT);
    await page.goto("/oficinas");

    const headerZIndex = await headerZ(page);

    const menu = await openAvatarDropdown(page);
    const menuRect = await menu.boundingBox();
    expect(menuRect).not.toBeNull();

    await menu.getByRole("button", { name: "Enviar sugerencia" }).click();
    await page.locator("#feedback_modal .modal-box").waitFor({ state: "visible" });
    const modalZ = Number(
      await page.evaluate(() =>
        Number(getComputedStyle(document.querySelector("#feedback_modal")!).zIndex),
      ),
    );
    expect(modalZ).toBeGreaterThan(headerZIndex);
    const coveredByModal = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return Boolean(
          el && document.querySelector("#feedback_modal")?.contains(el),
        );
      },
      { x: menuRect!.x + menuRect!.width / 2, y: menuRect!.y + 10 },
    );
    expect(coveredByModal, "el modal debe tapar el dropdown").toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.locator("#feedback_modal")).toBeHidden();

    const toastZ = Number(
      await page.evaluate(
        () =>
          Number(
            getComputedStyle(document.getElementById("global-toast-container")!)
              .zIndex,
          ),
      ),
    );
    expect(toastZ).toBeGreaterThan(headerZIndex);

    await cleanupTestUser(user.userId, user.sessionId);
  });

  test("el drawer lateral sigue cubriendo la navbar", async ({ page, context }) => {
    const user = await createTestUserAndSession("agent");
    await setSessionCookie(context, user.signedSessionId);
    await page.setViewportSize({ width: 420, height: 800 });
    await page.goto("/");
    const asideZ = Number(
      await page.evaluate(
        () =>
          Number(getComputedStyle(document.querySelector(".drawer-side")!).zIndex),
      ),
    );
    const headerZIndex = await headerZ(page);
    expect(asideZ).toBeGreaterThan(headerZIndex);
    await cleanupTestUser(user.userId, user.sessionId);
  });
});
