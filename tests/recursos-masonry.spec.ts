import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
  type TestUser,
} from "./helpers/auth";

let admin: TestUser;

test.beforeAll(async () => {
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  if (admin) {
    await cleanupTestUser(admin.userId, admin.sessionId);
  }
});

/**
 * Masonry guarda posiciones absolutas: si un item cambia de altura y nadie
 * pide un `layout()`, la card crece encima de la que tiene debajo en su
 * columna. Se detecta con intersección de rectángulos — con posiciones
 * viejas y alturas nuevas el detector acierta (probado: 421x8 y 421x40).
 */
const overlaps = (page: {
  evaluate: <T>(fn: () => T) => Promise<T>;
}): Promise<string[]> =>
  page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll("#important-links-grid .grid-item"),
    ).filter((el) => el.getClientRects().length > 0);
    const rects = items.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const found: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 2 && oy > 2) found.push(`#${i}-#${j} ${ox}x${oy}`);
      }
    }
    return found;
  });

test.describe("Masonry de /recursos", () => {
  test("las cards no se superponen al alternar descripciones", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/recursos", { waitUntil: "load" });
    await page.waitForSelector("#important-links-grid .grid-item");

    expect(await overlaps(page), "sin superposiciones iniciales").toEqual([]);

    const toggle = page.locator("#hide-descriptions-toggle");
    expect(await toggle.count(), "el toggle de descripciones existe").toBe(1);

    // Doble alternancia: cada transición hacia cards más altas sin re-layout
    // deja las posiciones viejas y produce la superposición del bug.
    for (const step of ["ocultar", "mostrar"]) {
      const checked = await toggle.isChecked();
      if (checked) await toggle.uncheck({ force: true });
      else await toggle.check({ force: true });
      await page.waitForTimeout(600);

      expect(
        await overlaps(page),
        `sin superposiciones al ${step} descripciones`,
      ).toEqual([]);
    }
  });

  test("las cards no se superponen al redimensionar la ventana", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/recursos", { waitUntil: "load" });
    await page.waitForSelector("#important-links-grid .grid-item");

    for (const width of [1280, 900, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(700);
      expect(
        await overlaps(page),
        `sin superposiciones al redimensionar a ${width}px`,
      ).toEqual([]);
    }
  });

  test("redimensionar con descripciones ocultas y volver tampoco rompe", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, admin.signedSessionId);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/recursos", { waitUntil: "load" });
    await page.waitForSelector("#important-links-grid .grid-item");

    const toggle = page.locator("#hide-descriptions-toggle");
    if (!(await toggle.isChecked())) await toggle.check({ force: true });
    await page.waitForTimeout(500);
    expect(await overlaps(page), "con descripciones ocultas").toEqual([]);

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(700);
    expect(await overlaps(page), "ocultas a 1200px").toEqual([]);

    if (await toggle.isChecked()) await toggle.uncheck({ force: true });
    await page.waitForTimeout(600);
    expect(await overlaps(page), "ocultas → visibles (cards más altas)").toEqual([]);
  });
});
