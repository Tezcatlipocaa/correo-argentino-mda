/**
 * normalize-titles — script ONE-TIME idempotente que corrige el formato de
 * `titles.name`: el guion separador debe quedar con un espacio de cada lado
 * ("Servicio- Incidente" -> "Servicio - Incidente").
 *
 * Seguridad:
 *   - DRY-RUN por defecto: NO escribe.
 *   - `--apply` hace backup WAL-safe con `db.backup()` (incluye -wal) y escribe
 *     en UNA transacción sincrona. Nunca borra filas.
 *
 * Uso:
 *   npx tsx scripts/normalize-titles.mts               # dry-run
 *   npx tsx scripts/normalize-titles.mts --apply       # escribe
 *   npx tsx scripts/normalize-titles.mts --db <ruta>   # otra DB
 */
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve } from "path";
import { formatTitleName } from "../src/lib/titleFormat";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dbFlag = args.indexOf("--db");
const dbPath = resolve(
  dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db",
);

if (!existsSync(dbPath)) {
  console.error(`No existe la DB: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: !apply });

const rows = db
  .prepare("SELECT id, name FROM titles")
  .all() as Array<{ id: number; name: string }>;

const changes = rows
  .map((row) => ({
    id: row.id,
    before: row.name,
    after: formatTitleName(row.name),
  }))
  .filter((change) => change.before !== change.after);

console.log(
  `normalize-titles — ${apply ? "APPLY" : "DRY-RUN"}\nDB: ${dbPath}\nTítulos: ${rows.length} | a cambiar: ${changes.length}\n`,
);
for (const change of changes) {
  console.log(`  #${change.id} "${change.before}" -> "${change.after}"`);
}

if (!apply) {
  console.log("\nDry-run: no se escribió nada. Usá --apply para aplicar.");
  db.close();
  process.exit(0);
}

if (changes.length === 0) {
  console.log("\nNada para actualizar. DB ya normalizada.");
  db.close();
  process.exit(0);
}

const backupPath = `${dbPath.replace(/\.db$/, "")}.bak-normalize-titles-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.db`;

try {
  await db.backup(backupPath);
} catch (error) {
  console.error("Falló el backup; se aborta sin escribir:", error);
  db.close();
  process.exit(1);
}

const update = db.prepare("UPDATE titles SET name = ? WHERE id = ?");
const applyAll = db.transaction((list: typeof changes) => {
  for (const change of list) {
    update.run(change.after, change.id);
  }
});
applyAll(changes);

console.log(
  `\nActualizados: ${changes.length}\nBackup: ${backupPath}\nRESULTADO: títulos normalizados.`,
);
db.close();
