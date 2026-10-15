import { z } from "zod";

/**
 * Validación central de variables de entorno (#234). Las críticas son las que,
 * si faltan o están mal formadas, rompen la seguridad del portal; el resto se
 * reporta para auditoría pero no bloquea (tiene fallbacks o es de integraciones).
 */
const criticalSchema = z.object({
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET debe tener al menos 32 caracteres"),
  ENCRYPTION_KEY: z.string().min(16, "ENCRYPTION_KEY es requerida"),
});

const optionalKeys = [
  "EXTERNAL_STORAGE_DIR",
  "INTERNAL_ORIGIN",
  "INVGATE_API_KEY",
  "INVGATE_API_USERNAME",
  "INVGATE_BASE_URL",
  "INVGATE_QA_API_KEY",
  "INVGATE_QA_API_USERNAME",
  "INVGATE_QA_BASE_URL",
  "LDAP_SERVER",
  "LDAP_PORT",
  "LDAP_BASE_DN",
  "LDAP_USER",
  "LDAP_PASS",
  "MIDPOINT_USER",
  "MIDPOINT_PASS",
  "WISE_CX_API_KEY",
  "WISE_CX_API_USER",
  "WISE_CX_BASE_URL",
] as const;

export type ServerEnvValidation = {
  ok: boolean;
  missing: string[];
  invalid: string[];
  absentOptional: string[];
};

function valueOf(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
}

export function validateServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnvValidation {
  const critical = criticalSchema.safeParse({
    SESSION_SECRET: valueOf(env, "SESSION_SECRET"),
    ENCRYPTION_KEY: valueOf(env, "ENCRYPTION_KEY"),
  });

  const missing: string[] = [];
  const invalid: string[] = [];
  if (!critical.success) {
    for (const issue of critical.error.issues) {
      const key = String(issue.path[0]);
      if (valueOf(env, key) === undefined) missing.push(key);
      else invalid.push(key);
    }
  }

  const absentOptional = optionalKeys.filter((key) => valueOf(env, key) === undefined);
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, absentOptional };
}

/**
 * Fail-fast (#234): en producción aborta si falta una crítica; en dev/log avisa,
 * para no romper worktrees locales sin .env completo.
 */
export function assertServerEnv(env: NodeJS.ProcessEnv = process.env): void {
  const result = validateServerEnv(env);
  if (!result.ok) {
    const detail = [
      result.missing.length ? `faltan: ${result.missing.join(", ")}` : "",
      result.invalid.length ? `inválidas: ${result.invalid.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    const message = `Variables de entorno críticas ${detail}. Revisá .env (ver .env.example).`;
    if (env.NODE_ENV === "production") throw new Error(message);
    console.error(`[env] ${message}`);
  }
}
