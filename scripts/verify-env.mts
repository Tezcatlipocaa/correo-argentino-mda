/**
 * verify-env — valida las variables críticas antes del build/deploy (#234).
 * Falla con exit 1 si falta una crítica.
 *
 * Uso: npx tsx scripts/verify-env.mts
 */
import "dotenv/config";
import { validateServerEnv, validateScriptEnv } from "../src/lib/env";

const result = validateServerEnv();
const scripts = validateScriptEnv();
if (!result.ok || !scripts.ok) {
  if (!result.ok) {
    console.error(
      `[verify-env] Variables críticas ausentes o inválidas — faltan: ${result.missing.join(", ") || "-"}; inválidas: ${result.invalid.join(", ") || "-"}`,
    );
  }
  if (!scripts.ok) {
    console.error(
      `[verify-env] Prerequisitos de jobs ausentes (script-critical) — faltan: ${scripts.missing.join(", ") || "-"}. Los jobs de sync morirían en silencio.`,
    );
  }
  process.exit(1);
}
console.log(
  `[verify-env] OK. Opcionales ausentes: ${result.absentOptional.join(", ") || "ninguna"}`,
);
