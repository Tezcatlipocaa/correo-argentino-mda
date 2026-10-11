/**
 * backfill-kb-categories — one-time idempotente: crea las filas de
 * `kb_categories` que les faltan a los valores de texto libre de
 * `kb_articles.category` (artículos previos a la v2).
 *
 * Seguridad: dry-run por defecto, `--apply` con backup WAL-safe, transacción
 * sincrona, idempotente, nunca borra ni modifica artículos.
 *
 * Uso:
 *   npx tsx scripts/backfill-kb-categories.mts            # dry-run
 *   npx tsx scripts/backfill-kb-categories.mts --apply
 *   npx tsx scripts/backfill-kb-categories.mts --db <ruta>
 */
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { basename, dirname, join } from "path";

export type MissingCategory = {
  helpdeskId: number;
  name: string;
  articles: number;
};

export type BackfillKbCategoriesReport = {
  dryRun: boolean;
  scannedHelpdesks: number;
  missing: MissingCategory[];
  created: MissingCategory[];
  backupPath: string | null;
};

const MISSING_SQL = `
  SELECT a.helpdesk_id AS helpdeskId, trim(a.category) AS name, count(*) AS articles
  FROM kb_articles a
  WHERE a.category IS NOT NULL
    AND length(trim(a.category)) > 0
    AND NOT EXISTS (
      SELECT 1 FROM kb_categories k
      WHERE k.helpdesk_id = a.helpdesk_id
        AND lower(k.name) = lower(trim(a.category))
    )
  GROUP BY a.helpdesk_id, trim(a.category)
  ORDER BY a.helpdesk_id, lower(trim(a.category))
`;

const SCAN_MESAS_SQL = `
  SELECT count(DISTINCT helpdesk_id) AS total FROM (
    SELECT helpdesk_id FROM kb_articles
    WHERE category IS NOT NULL AND length(trim(category)) > 0
  )
`;

export async function runBackfillKbCategories(options: {
  dbPath: string;
  apply: boolean;
}): Promise<BackfillKbCategoriesReport> {
  const { dbPath, apply } = options;
  if (!existsSync(dbPath)) throw new Error(`No existe la DB: ${dbPath}`);

  // En dry-run abrimos readonly; si la DB tiene WAL pendiente de recuperar
  // o los archivos -shm/-wal no permiten escritura, better-sqlite3 lanza.
  // Fallback a read-write para que el dry-run no falle. En apply nunca se
  // abre readonly, así que el fallback no debilita la escritura.
  let db: Database.Database;
  if (apply) {
    db = new Database(dbPath);
  } else {
    try {
      db = new Database(dbPath, { readonly: true });
    } catch {
      db = new Database(dbPath);
    }
  }
  try {
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    const missingTables = ["kb_categories", "kb_articles"].filter(
      (table) => !tables.includes(table),
    );
    if (missingTables.length > 0) {
      const list = missingTables.join('", "');
      throw new Error(
        missingTables.length > 1
          ? `La DB no tiene las tablas "${list}": corré align-db-to-schema.mts primero.`
          : `La DB no tiene la tabla "${list}": corré align-db-to-schema.mts primero.`,
      );
    }

    const [scan] = db.prepare(SCAN_MESAS_SQL).all() as [{ total: number }];
    const missing = db.prepare(MISSING_SQL).all() as MissingCategory[];

    const report: BackfillKbCategoriesReport = {
      dryRun: !apply,
      scannedHelpdesks: Number(scan?.total ?? 0),
      missing,
      created: [],
      backupPath: null,
    };

    if (!apply || missing.length === 0) return report;

    const backupPath = join(
      dirname(dbPath),
      `${basename(dbPath, ".db")}.bak-backfill-kb-categories-${Date.now()}.db`,
    );
    await db.backup(backupPath);
    report.backupPath = backupPath;

    const insert = db.prepare(
      `INSERT OR IGNORE INTO kb_categories (helpdesk_id, name, created_at)
       VALUES (?, ?, unixepoch())`,
    );
    const created: MissingCategory[] = [];
    const tx = db.transaction(() => {
      for (const row of missing) {
        const changes = insert.run(row.helpdeskId, row.name).changes;
        if (changes > 0) created.push(row);
      }
    });
    tx();

    report.created = created;
    report.missing = db.prepare(MISSING_SQL).all() as MissingCategory[];
    return report;
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  let dbPath = join(process.cwd(), "database", "mda.db");
  let dbPathSet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--apply") continue;
    if (arg === "--db") {
      if (dbPathSet) throw new Error("--db especificado más de una vez");
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--db requiere una ruta como valor");
      }
      dbPath = value;
      dbPathSet = true;
      i++;
      continue;
    }
    if (arg.startsWith("--db=")) {
      if (dbPathSet) throw new Error("--db especificado más de una vez");
      const value = arg.slice("--db=".length);
      if (value.length === 0 || value.startsWith("--")) {
        throw new Error("--db requiere una ruta como valor");
      }
      dbPath = value;
      dbPathSet = true;
      continue;
    }
    throw new Error(`Argumento desconocido: ${arg}`);
  }

  const report = await runBackfillKbCategories({ dbPath, apply });
  console.log(`\nbackfill-kb-categories — ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`DB: ${dbPath}`);
  console.log(`mesas con artículos categorizados : ${report.scannedHelpdesks}`);
  console.log(`categorías faltantes              : ${report.missing.length}`);
  for (const row of report.missing) {
    console.log(
      `  mesa ${row.helpdeskId} · ${row.name} · ${row.articles} artículo(s)`,
    );
  }
  console.log(`creadas                           : ${report.created.length}`);
  console.log(
    `backup                            : ${report.backupPath ?? "(dry-run, no se crea)"}`,
  );
  if (!apply)
    console.log("\nUsá --apply para escribir (crea backup WAL-safe).");
}

const isDirectRun = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("scripts/backfill-kb-categories.mts");
if (isDirectRun) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
