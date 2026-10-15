/**
 * verify-env — valida las variables críticas antes del build/deploy (#234).
 * Falla con exit 1 si falta una crítica.
 *
 * Uso: npx tsx scripts/verify-env.mts
 */
import "dotenv/config";
import { validateServerEnv } from "../src/lib/env";

const result = validateServerEnv();
if (!result.ok) {
  console.error(
    `[verify-env] Variables críticas ausentes o inválidas — faltan: ${result.missing.join(", ") || "-"}; inválidas: ${result.invalid.join(", ") || "-"}`,
  );
  process.exit(1);
}
console.log(
  `[verify-env] OK. Opcionales ausentes: ${result.absentOptional.join(", ") || "ninguna"}`,
);
