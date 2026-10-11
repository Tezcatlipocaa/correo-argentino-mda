import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "../helpers/auth";

let session: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  session = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await cleanupTestUser(session.userId, session.sessionId);
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, session.signedSessionId);
});

const MIN_TARGET_PX = 32;

const ROUTES = [
  "/oficinas",
  "/contactos",
  "/recursos",
  "/recursos/aplicativos",
  "/inventario-terminales",
  "/generador-firmas",
  "/buscador-usuarios",
  "/supervision/cronograma",
  "/admin/usuarios",
  "/admin/recursos",
  "/admin/aplicativos",
  "/mesas-de-ayuda",
];

/**
 * Exenciones explícitas y justificadas. Cada entrada necesita una razón:
 * la alternativa es romper el layout de una zona densa.
 * Ejemplo: { route: "/ruta", match: "clase-o-selector", reason: "por qué" }
 */
const ALLOWLIST: { route: string; match: string; reason: string }[] = [];

for (const route of ROUTES) {
  test(`objetivos tactiles de solo icono >= ${MIN_TARGET_PX}px: ${route}`, async ({
    page,
  }) => {
    await page.goto(route, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    expect(
      new URL(page.url()).pathname,
      `la sesion no autentico: se esperaba ${route}`,
    ).toBe(route);

    const small = await page.evaluate((min) => {
      const visible = (el: Element) => {
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") return false;
        return el.getClientRects().length > 0;
      };
      return Array.from(
        document.querySelectorAll('button, [role="button"], a[href], summary'),
      )
        .filter(visible)
        .filter((el) => (el.textContent ?? "").trim() === "")
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            className: typeof el.className === "string" ? el.className : "",
            tag: el.tagName.toLowerCase(),
            w: Math.round(r.width),
            h: Math.round(r.height),
            min: Math.round(Math.min(r.width, r.height)),
          };
        })
        .filter((e) => e.w < min || e.h < min)
        .map((e) => `${e.tag}.${e.className} (${e.w}x${e.h})`);
    }, MIN_TARGET_PX);

    const allowed = ALLOWLIST.filter((a) => a.route === route).map(
      (a) => a.match,
    );
    const offenders = small.filter((s) => !allowed.some((m) => s.includes(m)));

    expect(
      offenders,
      `elementos de solo icono menores a ${MIN_TARGET_PX}px en ${route}`,
    ).toEqual([]);
  });
}
