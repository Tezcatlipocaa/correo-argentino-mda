import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SESSION_DIR = path.resolve(process.cwd(), "database/.invgate-session");
const COOKIE_FILE = path.resolve(process.cwd(), "database/.invgate-web-cookie.json");

let cachedCookie: string | null = null;

function getInvgateWebBase(): string {
  const raw =
    process.env.INVGATE_BASE_URL ||
    (typeof import.meta !== "undefined" ? (import.meta.env as any)?.INVGATE_BASE_URL : "") ||
    "";
  return raw.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
}

export function getCachedInvgateWebCookie(): string | null {
  if (cachedCookie) return cachedCookie;
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const data = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
      if (data?.cookie && typeof data.cookie === "string") {
        cachedCookie = data.cookie;
        return cachedCookie;
      }
    }
  } catch {
    // Ignore read error
  }
  return null;
}

export function saveInvgateWebCookie(cookieValue: string): void {
  cachedCookie = cookieValue;
  try {
    fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
    fs.writeFileSync(
      COOKIE_FILE,
      JSON.stringify({ cookie: cookieValue, updatedAt: new Date().toISOString() }, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore write error
  }
}

export interface RefreshInvgateSessionResult {
  cookie: string;
  html?: string;
}

/**
 * Abre un contexto persistente de navegador, hace clic en el botón "Iniciar sesión" (Azure AD SAML),
 * espera a que cargue la vista del ticket en InvGate, guarda la cookie IGSMSESSID y cierra el navegador.
 */
export async function refreshInvgateWebSession(
  ticketId: string = "90688",
  options?: { headless?: boolean; timeoutMs?: number },
): Promise<RefreshInvgateSessionResult> {
  const base = getInvgateWebBase();
  if (!base) {
    throw new Error("[InvGate Web] INVGATE_BASE_URL no configurada.");
  }

  const targetUrl = `${base}/requests/show/index/id/${encodeURIComponent(ticketId)}`;
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const headless = options?.headless ?? false;

  fs.mkdirSync(SESSION_DIR, { recursive: true });

  const context = await chromium
    .launchPersistentContext(SESSION_DIR, {
      headless,
      channel: "msedge",
    })
    .catch(() =>
      chromium.launchPersistentContext(SESSION_DIR, {
        headless,
      }),
    );

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // Si está en la pantalla de login de InvGate, hacer click en el botón de Azure SSO
    const azureBtn = page.locator('a[data-login-type="azure"]');
    if (await azureBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await azureBtn.click();
    }

    // Esperar a que termine la redirección SAML y desaparezca #form_login en el dominio de InvGate
    await page.waitForFunction(
      () =>
        window.location.pathname.includes("/requests/show/index/id/") &&
        !document.querySelector("#form_login"),
      { timeout: timeoutMs },
    );

    // Esperar brevemente a que se rendericen las actividades / historial del ticket
    await page.waitForTimeout(2500);

    const cookies = await context.cookies(base);
    const sessCookie = cookies.find((c) => c.name === "IGSMSESSID");
    if (!sessCookie?.value) {
      throw new Error("[InvGate Web] No se obtuvo la cookie IGSMSESSID tras el login de Azure.");
    }

    saveInvgateWebCookie(sessCookie.value);
    const html = await page.content();

    return {
      cookie: sessCookie.value,
      html,
    };
  } finally {
    await context.close().catch(() => {});
  }
}
