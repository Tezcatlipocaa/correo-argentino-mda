/**
 * enrich-titles — rellena los campos de InvGate de la tabla `titles` (KB por
 * título) sin tocar InvGate en cada request: se corre una vez por tandas y se
 * persiste en la DB (que luego viaja al server vía el dump/apply).
 *
 * Por ahora cubre el match de BASE DE CONOCIMIENTOS (`article_on_kdb`,
 * `article_on_kdb_title`, `kb_match_score`). La ruta/descripción (histórico)
 * queda para cuando exista una vista de InvGate configurada.
 *
 * Seguridad:
 *   - DRY-RUN por defecto (no escribe).
 *   - `--apply` escribe en transacción sincrona. Nunca borra filas ni toca
 *     `name`/`category_id`.
 *   - `--only-null` (default): solo títulos con `enriched_at IS NULL`.
 *
 * Uso:
 *   npx tsx scripts/enrich-titles.mts [--limit 50] [--only-null] [--apply]
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve } from "path";
import { searchKbArticles } from "../src/lib/invgate/kb";
import {
  pickBestKbArticle,
  KB_MATCH_DEFAULT_THRESHOLD,
} from "../src/lib/titles/kbMatch";
import { getServerEnv } from "../src/lib/invgate/automation/env";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyNull = !args.includes("--all");
const limitFlag = args.indexOf("--limit");
const limit =
  limitFlag >= 0 && args[limitFlag + 1]
    ? Number.parseInt(args[limitFlag + 1], 10)
    : 50;
const dbFlag = args.indexOf("--db");
const dbPath = resolve(
  dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db",
);

const threshold = (() => {
  const raw = Number.parseFloat(getServerEnv("TITLE_KB_THRESHOLD"));
  return Number.isFinite(raw) && raw > 0 && raw <= 1
    ? raw
    : KB_MATCH_DEFAULT_THRESHOLD;
})();

if (!existsSync(dbPath)) {
  console.error(`No existe la DB: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: !apply });

const where = onlyNull ? "WHERE enriched_at IS NULL" : "";
const rows = db
  .prepare(`SELECT id, name FROM titles ${where} ORDER BY name LIMIT ?`)
  .all(Number.isInteger(limit) && limit > 0 ? limit : 50) as Array<{
  id: number;
  name: string;
}>;

console.log(
  `enrich-titles — ${apply ? "APPLY" : "DRY-RUN"} | umbral ${threshold} | ${onlyNull ? "solo pendientes" : "todos"} | ${rows.length} títulos\n`,
);

let matched = 0;
let noMatch = 0;
const updates: { id: number; articleId: number; title: string; score: number }[] =
  [];

for (const row of rows) {
  const result = await searchKbArticles(row.name);
  const articles = result.ok ? result.data : [];
  const best = pickBestKbArticle(row.name, articles, threshold);
  if (best) {
    matched++;
    updates.push({
      id: row.id,
      articleId: best.id,
      title: best.title,
      score: best.score,
    });
    console.log(
      `  #${row.id} "${row.name}" -> KB #${best.id} (${best.score.toFixed(2)}) "${best.title}"`,
    );
  } else {
    noMatch++;
    console.log(`  #${row.id} "${row.name}" -> sin match`);
  }

  if (!apply) continue;

  // En apply también marcamos los "sin match" como enriquecidos (evita repetir).
  const resolved = best;
  db.prepare(
    "UPDATE titles SET article_on_kdb = ?, article_on_kdb_title = ?, kb_match_score = ?, enriched_at = ? WHERE id = ?",
  ).run(
    resolved ? String(resolved.id) : null,
    resolved ? resolved.title : null,
    resolved ? resolved.score : null,
    Math.floor(Date.now() / 1000),
    row.id,
  );
}

if (!apply) {
  console.log(
    `\nDry-run: ${matched} con match, ${noMatch} sin match. Usá --apply para escribir.`,
  );
} else {
  console.log(
    `\nActualizados: ${rows.length} (${matched} con match, ${noMatch} sin match).`,
  );
}
db.close();
