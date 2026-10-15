import "dotenv/config";
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUserAndSession,
  setSessionCookie,
} from "../helpers/auth";
import { getIconsDir } from "../../src/lib/storage";

// Páginas que DEBEN funcionar sin sesión: el login y el generador de firmas.
const PUBLIC_PAGES = ["/login", "/generador-firmas"];

test.describe("páginas públicas sin sesión (#232)", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} es pública y no depende de APIs privadas`, async ({ page }) => {
      const apiRequests: string[] = [];
      const unauthorized: string[] = [];
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith("/api/")) apiRequests.push(u.pathname);
      });
      page.on("response", (r) => {
        if (r.status() === 401) unauthorized.push(new URL(r.url()).pathname);
      });
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      // Si esto falla mostrando paths, agregarlos a PUBLIC_API_PREFIXES del gate
      // (o quitar el gate de esa página si no debería pedir sesión).
      expect(unauthorized).toEqual([]);
      expect(apiRequests.filter((p) => !p.startsWith("/api/icons"))).toEqual([]);
    });
  }
});

const ANON_API_401 = [
  "/api/usuarios/search?q=a",
  "/api/usuarios/status?username=a",
  "/api/usuarios/net-user?username=a",
  "/api/usuarios/invgate-user?username=a",
  "/api/titulos/export.csv",
  "/api/download/archivo.pdf",
  "/api/invgate/group-search?q=a",
  "/api/disponibilidad",
  "/api/offices-map-data",
];

test.describe("default-deny para anónimos (#232)", () => {
  for (const path of ANON_API_401) {
    test(`anónimo recibe 401 en ${path}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(401);
    });
  }

  for (const path of ["/login", "/generador-firmas"]) {
    test(`anónimo accede a la página pública ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }

  test("anónimo accede a un ícono público de la allowlist", async ({
    request,
  }) => {
    const files = fs
      .readdirSync(getIconsDir())
      .filter((f) => !f.startsWith("."));
    expect(files.length).toBeGreaterThan(0);
    const res = await request.get(`/api/icons/${files[0]}`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
  });

  test("un usuario logueado recibe 200 en /api/usuarios/status", async ({
    context,
  }) => {
    const user = await createTestUserAndSession("agent");
    try {
      await setSessionCookie(context, user.signedSessionId);
      const res = await context.request.get(
        "/api/usuarios/status?username=a",
        { maxRedirects: 0 },
      );
      // Guard de sesión (no de rol): cualquier rol logueado accede.
      expect(res.status()).toBe(200);
    } finally {
      await cleanupTestUser(user.userId, user.sessionId);
    }
  });

  test("un agent logueado no recibe 401 en /api/usuarios/search (vs. anónimo 401)", async ({
    context,
  }) => {
    const user = await createTestUserAndSession("agent");
    try {
      await setSessionCookie(context, user.signedSessionId);
      const res = await context.request.get("/api/usuarios/search?q=a", {
        maxRedirects: 0,
      });
      // El guard es solo de sesión: un agent logueado pasa (200), no 403.
      expect(res.status()).toBe(200);
    } finally {
      await cleanupTestUser(user.userId, user.sessionId);
    }
  });

  for (const path of ["/buscador-usuarios", "/contactos", "/"]) {
    test(`anónimo es redirigido a /login en ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe("/login");
    });
  }

  test("un usuario logueado sigue accediendo a /, /buscador-usuarios y /contactos", async ({
    context,
    page,
  }) => {
    const user = await createTestUserAndSession("agent");
    try {
      await setSessionCookie(context, user.signedSessionId);
      for (const path of ["/", "/buscador-usuarios", "/contactos"]) {
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe(path);
      }
    } finally {
      await cleanupTestUser(user.userId, user.sessionId);
    }
  });
});
