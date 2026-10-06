/**
 * dump-quality-parameters.mts — exporta la configuración de parámetros de
 * calidad (`audit_parameters`) de la base de datos local a un archivo JSON
 * versionado en el repositorio (`src/data/quality-parameters.json`), para que
 * viajen al servidor vía git y se apliquen en producción con
 * `scripts/apply-quality-parameters.mts`.
 *
 * Uso:
 *   npx tsx scripts/dump-quality-parameters.mts [--db <ruta>] [--out <ruta>]
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const args = process.argv.slice(2);
const dbFlag = args.indexOf("--db");
const dbPath = resolve(
  dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db",
);
const outFlag = args.indexOf("--out");
const outPath = resolve(
  outFlag >= 0 && args[outFlag + 1]
    ? args[outFlag + 1]
    : "./src/data/quality-parameters.json",
);

if (!existsSync(dbPath)) {
  console.error(`No existe la DB en: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `SELECT code, name, weight, category, channel, section, [order], active
     FROM audit_parameters
     ORDER BY channel, [order], id`,
  )
  .all() as Array<{
    code: string;
    name: string;
    weight: number | null;
    category: string;
    channel: string;
    section: string;
    order: number;
    active: number;
  }>;
db.close();

const payload = {
  generatedAt: new Date().toISOString(),
  count: rows.length,
  activeCount: rows.filter((r) => r.active === 1).length,
  parameters: rows.map((r) => ({
    code: r.code,
    name: r.name,
    weight: r.weight,
    category: r.category,
    channel: r.channel,
    section: r.section,
    order: r.order,
    active: r.active === 1,
  })),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(
  `Dump de parámetros escrito en: ${outPath} (${payload.count} parámetros, ${payload.activeCount} activos).`,
);
