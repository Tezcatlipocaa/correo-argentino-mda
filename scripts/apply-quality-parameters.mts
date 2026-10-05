/**
 * apply-quality-parameters — aplica el dump `src/data/quality-parameters.json`
 * sobre la tabla `audit_parameters` de la base de datos (por defecto ./database/mda.db).
 *
 * Invariantes de seguridad:
 *   - Dry-run por defecto si no se especifica --apply.
 *   - Con --apply: backup WAL-safe previo antes de escribir en transacción.
 *   - Matchea por `code` único, preservando los `id` para auditorías históricas.
 *   - Nunca borra filas; solo desactiva (`active = 0`).
 *
 * Uso:
 *   npx tsx scripts/apply-quality-parameters.mts               # Dry-run
 *   npx tsx scripts/apply-quality-parameters.mts --apply       # Aplica cambios con backup
 *   npx tsx scripts/apply-quality-parameters.mts --db <ruta>   # Otra ruta de DB
 *   npx tsx scripts/apply-quality-parameters.mts --in <ruta>   # Otra ruta de archivo JSON
 */
import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  applyParameters,
  type QualityParametersDump,
} from "./migrate-quality-parameters.mts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dbFlag = args.indexOf("--db");
const dbPath = resolve(
  dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db"
);
const inFlag = args.indexOf("--in");
const inPath = resolve(
  inFlag >= 0 && args[inFlag + 1]
    ? args[inFlag + 1]
    : "./src/data/quality-parameters.json"
);

if (!existsSync(inPath)) {
  console.error(`[ERROR] No existe el dump de parámetros: ${inPath}`);
  console.error(
    `Generalo previamente con: npx tsx scripts/dump-quality-parameters.mts`
  );
  process.exit(1);
}

const payload = JSON.parse(readFileSync(inPath, "utf8")) as QualityParametersDump;

if (!payload || !Array.isArray(payload.parameters)) {
  console.error(`[ERROR] Formato inválido en ${inPath}`);
  process.exit(1);
}

applyParameters({
  sourceParams: payload.parameters,
  targetDbPath: dbPath,
  apply,
}).catch((err) => {
  console.error(`\n[FATAL ERROR] ${err.message}`);
  process.exit(1);
});
