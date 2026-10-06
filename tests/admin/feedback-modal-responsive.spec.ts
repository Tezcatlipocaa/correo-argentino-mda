import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-320", width: 320, height: 568 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

async function openFeedbackModal(page: Page) {
  await page.goto("/");
  await page.locator("nav.navbar .dropdown [role='button']").first().click();
  const btn = page.locator("[data-open-feedback-modal]").first();
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.locator("#feedback_modal")).toBeVisible();
}

test.describe("Feedback modal responsiveness", () => {
  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUserAndSession("agent");
  });

  test.afterAll(async () => {
    await cleanupTestUser(user.userId, user.sessionId);
  });

  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow and all buttons inside box @${vp.name}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setSessionCookie(context, user.signedSessionId);
      await openFeedbackModal(page);

      const modalBox = page.locator("#feedback_modal .modal-box");
      await expect(modalBox).toBeVisible();

      for (const tab of ["sugerencia", "bug"] as const) {
        if (tab === "bug") {
          await page.locator("#tab-bug").click();
          await expect(page.locator("#bug-form")).toBeVisible();
        }

        const metrics = await page
          .locator("#feedback_modal .modal-box > div")
          .first()
          .evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            overflowX: getComputedStyle(el).overflowX,
          }));

        expect(
          metrics.scrollWidth,
          `${tab} @${vp.name}: scroll region overflows horizontally (scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth})`,
        ).toBeLessThanOrEqual(metrics.clientWidth + 1);

        const container = await modalBox.boundingBox();
        if (!container) throw new Error("modal-box has no bounding box");

        const buttons =
          tab === "sugerencia"
            ? [
                { sel: "#feedback_modal .modal-action [data-close-feedback-modal]:not(.btn-circle)", label: "Cancelar" },
                { sel: "#btn-submit-sugerencia", label: "Enviar sugerencia" },
              ]
            : [
                { sel: "#feedback_modal .modal-action [data-close-feedback-modal]:not(.btn-circle)", label: "Cancelar" },
                { sel: "#btn-submit-bug", label: "Reportar bug" },
              ];

        for (const b of buttons) {
          const loc = page.locator(b.sel);
          await expect(loc, `${b.label} @${vp.name} visible`).toBeVisible();
          const box = await loc.boundingBox();
          if (!box) throw new Error(`${b.label} has no bounding box`);
          expect(
            box.x + box.width,
            `${b.label} @${vp.name} overflows right edge of modal-box`,
          ).toBeLessThanOrEqual(container.x + container.width + 0.5);
          expect(
            box.x,
            `${b.label} @${vp.name} overflows left edge of modal-box`,
          ).toBeGreaterThanOrEqual(container.x - 0.5);
        }
      }
    });
  }

  test("modal does not introduce page-level horizontal scroll", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setSessionCookie(context, user.signedSessionId);
    await openFeedbackModal(page);

    const pageOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      pageOverflow,
      "page scrolls horizontally while modal open",
    ).toBeLessThanOrEqual(1);
  });

  test("scrollbars hidden without reserving gutter space", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await setSessionCookie(context, user.signedSessionId);
    await openFeedbackModal(page);

    // The scroll region is the box's first child; the footer is its sibling
    const style = await page
      .locator("#feedback_modal .modal-box > div")
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          scrollbarWidth: cs.scrollbarWidth,
          overflowY: cs.overflowY,
          scrollable: el.scrollHeight > el.clientHeight,
        };
      });

    expect(
      style.scrollable,
      "scroll region must actually scroll for this test to be meaningful",
    ).toBe(true);
    expect(
      style.scrollbarWidth,
      "scroll region scrollbar must be hidden (scrollbar-width: none)",
    ).toBe("none");
    expect(
      style.overflowY,
      "scroll region must keep vertical scrolling functional",
    ).toMatch(/auto|scroll/);
  });

  test("action bar is an opaque sibling of the scroll region", async ({
    page,
    context,
  }) => {
    // Bug tab is the tallest form: forces vertical scrolling inside the box
    await page.setViewportSize({ width: 375, height: 500 });
    await setSessionCookie(context, user.signedSessionId);
    await openFeedbackModal(page);
    await page.locator("#tab-bug").click();
    await expect(page.locator("#bug-form")).toBeVisible();

    const paint = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(
        "#feedback_modal .modal-box",
      )!;
      const region = box.querySelector<HTMLElement>(":scope > div")!;
      const bar = document.querySelector<HTMLElement>(
        "#feedback_modal .modal-action",
      )!.parentElement as HTMLElement;
      const boxRect = box.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const regionRect = region.getBoundingClientRect();
      const cs = getComputedStyle(bar);
      return {
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        isSibling: bar.previousElementSibling === region,
        // footer must be its own box, never overlapping the scroller
        overlapsScroller: barRect.top < regionRect.bottom - 1,
        flushWithBox:
          Math.abs(boxRect.bottom - barRect.bottom) <= 1 &&
          Math.abs(boxRect.left - barRect.left) <= 1 &&
          Math.abs(boxRect.right - barRect.right) <= 1,
        regionScrollable: region.scrollHeight > region.clientHeight,
        // content is clipped by the region, so it can never paint under the footer
        regionClips: getComputedStyle(region).overflowY !== "visible",
      };
    });

    expect(
      paint.backgroundImage,
      "footer must not rely on a gradient/image layer for coverage",
    ).toBe("none");

    const parts = paint.backgroundColor.match(/[\d.]+/g) ?? [];
    expect(
      parts.length,
      `footer background must be a plain color (got ${paint.backgroundColor})`,
    ).toBe(3);
    expect(
      paint.backgroundColor.startsWith("rgb("),
      `footer background must be fully opaque (got ${paint.backgroundColor})`,
    ).toBe(true);

    expect(
      paint.isSibling,
      "footer must be a sibling of the scroll region (opaque by construction)",
    ).toBe(true);
    expect(
      paint.regionScrollable,
      "scroll region must scroll for this test to be meaningful",
    ).toBe(true);
    expect(
      paint.overlapsScroller,
      "footer must not overlap the scroll region (no content behind it)",
    ).toBe(false);
    expect(
      paint.flushWithBox,
      "footer must span the full modal-box width and reach its bottom edge",
    ).toBe(true);
    expect(
      paint.regionClips,
      "scroll region must clip its content so nothing paints under the footer",
    ).toBe(true);

    // Scrolling the region must not move the footer
    const before = await page
      .locator("#feedback_modal .modal-action")
      .boundingBox();
    await page
      .locator("#feedback_modal .modal-box > div")
      .first()
      .evaluate((el) => el.scrollTo(0, 120));
    await page.waitForTimeout(150);
    const after = await page
      .locator("#feedback_modal .modal-action")
      .boundingBox();
    expect(
      Math.abs((after?.y ?? -1) - (before?.y ?? -2)),
      "footer must not move when the region scrolls",
    ).toBeLessThanOrEqual(1);

    // Cancelar (footer) must remain reachable and close the modal
    await page.locator("[data-close-feedback-modal]").click();
    await expect(page.locator("#feedback_modal")).not.toBeVisible();
  });

  test("both tabs are reachable and submit button swaps label", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setSessionCookie(context, user.signedSessionId);
    await openFeedbackModal(page);

    await expect(page.locator("#btn-submit-sugerencia")).toBeVisible();
    await expect(page.locator("#btn-submit-bug")).toBeHidden();

    await page.locator("#tab-bug").click();
    await expect(page.locator("#btn-submit-bug")).toBeVisible();
    await expect(page.locator("#btn-submit-sugerencia")).toBeHidden();

    await page.locator("#tab-sugerencia").click();
    await expect(page.locator("#btn-submit-sugerencia")).toBeVisible();
    await expect(page.locator("#btn-submit-bug")).toBeHidden();
  });

  test("cancel button closes the modal on mobile", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setSessionCookie(context, user.signedSessionId);
    await openFeedbackModal(page);

    await page
      .locator("#feedback_modal .modal-action [data-close-feedback-modal]:not(.btn-circle)")
      .click();
    await expect(page.locator("#feedback_modal")).not.toBeVisible();
  });
});
