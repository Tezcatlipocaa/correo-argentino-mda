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
  SELECT a.helpdesk_id AS helpdeskId, a.category AS name, count(*) AS articles
  FROM kb_articles a
  WHERE a.category IS NOT NULL
    AND length(trim(a.category)) > 0
    AND NOT EXISTS (
      SELECT 1 FROM kb_categories k
      WHERE k.helpdesk_id = a.helpdesk_id
        AND lower(k.name) = lower(a.category)
    )
  GROUP BY a.helpdesk_id, a.category
  ORDER BY a.helpdesk_id, lower(a.category)
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

  const db = new Database(dbPath);
  try {
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    if (!tables.includes("kb_categories") || !tables.includes("kb_articles")) {
      throw new Error(
        'La DB no tiene la tabla "kb_categories": corré align-db-to-schema.mts primero.',
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
    const tx = db.transaction(() => {
      for (const row of missing) insert.run(row.helpdeskId, row.name);
    });
    tx();

    report.created = missing;
    report.missing = db.prepare(MISSING_SQL).all() as MissingCategory[];
    return report;
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dbFlag = args.indexOf("--db");
  const dbPath =
    dbFlag !== -1 && args[dbFlag + 1]
      ? args[dbFlag + 1]
      : join(process.cwd(), "database", "mda.db");

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
