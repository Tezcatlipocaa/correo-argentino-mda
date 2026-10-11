import { createRequire } from "node:module";
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const require = createRequire(path.join(root, "package.json"));
const Database = require("better-sqlite3");

export const BASE_URL = process.env.MDA_BASE_URL || "http://localhost:4321";
export const BASE_HOST = new URL(BASE_URL).hostname;

function readEnv() {
  const envPath = path.join(root, ".env");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    out[trimmed.slice(0, i).trim()] = trimmed
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

function openDb() {
  return new Database(path.join(root, "database", "mda.db"));
}

/**
 * Crea una fila en `sessions` para un usuario admin y devuelve el valor de la
 * cookie `session_id` firmada (HMAC-SHA256 base64url), igual que el middleware.
 */
export function createAdminSession() {
  const secret =
    process.env.SESSION_SECRET || readEnv().SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET no disponible (.env ni process.env)");
  }

  const db = openDb();
  try {
    const user = db
      .prepare(
        "SELECT id, username, role FROM users WHERE role='admin' ORDER BY id LIMIT 1",
      )
      .get();
    if (!user) {
      throw new Error("No hay usuario admin en database/mda.db");
    }
    const sessionId = "session_audit_" + randomUUID();
    db.prepare(
      "INSERT INTO sessions (id, userId, expiresAt) VALUES (?,?,?)",
    ).run(sessionId, user.id, Date.now() + 3600 * 1000);
    const signature = createHmac("sha256", secret)
      .update(sessionId)
      .digest("base64url");
    return {
      cookie: `${sessionId}.${signature}`,
      sessionId,
      user: user.username,
      role: user.role,
    };
  } finally {
    db.close();
  }
}

/** Borra la fila de sesión creada por `createAdminSession`. */
export function destroyAdminSession(sessionId) {
  try {
    const db = openDb();
    try {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    } finally {
      db.close();
    }
  } catch {
    // best-effort cleanup
  }
}

/** Abre un contexto autenticado como admin y devuelve la page + datos de sesión. */
export async function newAuthenticatedPage(browser) {
  const session = createAdminSession();
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "session_id",
      value: session.cookie,
      domain: BASE_HOST,
      path: "/",
    },
  ]);
  const page = await context.newPage();
  return { page, context, session };
}
