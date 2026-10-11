/**
 * apply-titles-enrichment — aplica el dump `src/data/titles-enrichment.json`
 * sobre la tabla `titles` del servidor. Idempotente, matchea por nombre
 * normalizado, y solo escribe columnas de enriquecimiento (nunca `name` ni
 * `category_id`). Pensado para correr tras el align en el deploy.
 *
 * Uso:
 *   npx tsx scripts/apply-titles-enrichment.mts [--db <ruta>] [--in <ruta>]
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { normalizeForCompare } from "../src/lib/workflow/labels";

const args = process.argv.slice(2);
const dbFlag = args.indexOf("--db");
const dbPath = resolve(
  dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db",
);
const inFlag = args.indexOf("--in");
const inPath = resolve(
  inFlag >= 0 && args[inFlag + 1]
    ? args[inFlag + 1]
    : "./src/data/titles-enrichment.json",
);

if (!existsSync(dbPath)) {
  console.error(`No existe la DB: ${dbPath}`);
  process.exit(1);
}
if (!existsSync(inPath)) {
  console.error(`No existe el dump: ${inPath}`);
  process.exit(1);
}

interface EnrichedTitle {
  name: string;
  article_on_kdb: string | null;
  article_on_kdb_title: string | null;
  kb_match_score: number | null;
  route: string | null;
  description: string | null;
  enriched_at: number | null;
}

const payload = JSON.parse(readFileSync(inPath, "utf8")) as {
  titles: EnrichedTitle[];
};

const db = new Database(dbPath);
const rows = db.prepare("SELECT id, name FROM titles").all() as Array<{
  id: number;
  name: string;
}>;
const byName = new Map(rows.map((r) => [normalizeForCompare(r.name), r.id]));

const update = db.prepare(
  `UPDATE titles
   SET article_on_kdb = COALESCE(?, article_on_kdb),
       article_on_kdb_title = COALESCE(?, article_on_kdb_title),
       kb_match_score = COALESCE(?, kb_match_score),
       route = COALESCE(?, route),
       description = COALESCE(?, description),
       enriched_at = COALESCE(?, enriched_at)
   WHERE id = ?`,
);

let applied = 0;
let missing = 0;
const run = db.transaction((titles: EnrichedTitle[]) => {
  for (const t of titles) {
    const id = byName.get(normalizeForCompare(t.name));
    if (id === undefined) {
      missing++;
      continue;
    }
    update.run(
      t.article_on_kdb ?? null,
      t.article_on_kdb_title ?? null,
      t.kb_match_score ?? null,
      t.route ?? null,
      t.description ?? null,
      t.enriched_at ?? null,
      id,
    );
    applied++;
  }
});
run(payload.titles);
db.close();

console.log(
  `apply-titles-enrichment: ${applied} aplicados, ${missing} sin match por nombre.`,
);
