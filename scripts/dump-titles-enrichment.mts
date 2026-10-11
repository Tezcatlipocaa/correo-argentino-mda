/**
 * dump-titles-enrichment — exporta los campos de enriquecimiento de `titles`
 * (KB) a un JSON versionado en el repo, para que viajen al server vía git y se
 * apliquen con `apply-titles-enrichment.mts` (idempotente, matchea por nombre).
 *
 * Uso: npx tsx scripts/dump-titles-enrichment.mts [--db <ruta>] [--out <ruta>]
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
    : "./src/data/titles-enrichment.json",
);

if (!existsSync(dbPath)) {
  console.error(`No existe la DB: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `SELECT name, article_on_kdb, article_on_kdb_title, kb_match_score, route, description, enriched_at
     FROM titles
     WHERE enriched_at IS NOT NULL
     ORDER BY name`,
  )
  .all() as Array<Record<string, unknown>>;
db.close();

const payload = {
  generatedAt: new Date().toISOString(),
  count: rows.length,
  titles: rows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`Dump escrito: ${outPath} (${rows.length} títulos enriquecidos).`);
