import type Database from "better-sqlite3";

export type SchemaViolation =
  | {
      kind: "dropped_column";
      table: string;
      column: string;
      nonNullRows: number;
      message: string;
    }
  | {
      kind: "not_null_without_default";
      table: string;
      column: string;
      rowCount: number;
      message: string;
    }
  | {
      kind: "orphan_foreign_key";
      table: string;
      column: string;
      refTable: string;
      refColumn: string;
      onDelete: string;
      orphanCount: number;
      message: string;
    }
  | {
      kind: "type_change";
      table: string;
      column: string;
      fromType: string;
      toType: string;
      message: string;
    };

export interface SchemaGuardResult {
  ok: boolean;
  violations: SchemaViolation[];
}

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface ForeignKeyInfo {
  table: string;
  from: string;
  to: string;
  on_delete: string;
  on_update: string;
}

function listUserTables(db: Database.Database): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' AND name != '__drizzle_migrations'",
      )
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

function getColumns(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info("${table}")`).all() as ColumnInfo[];
}

function getForeignKeys(db: Database.Database, table: string): ForeignKeyInfo[] {
  return db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as ForeignKeyInfo[];
}

function getRowCount(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number };
  return row.c;
}

export function analyzeSchemaGuard(
  canonical: Database.Database,
  target: Database.Database,
): SchemaGuardResult {
  const violations: SchemaViolation[] = [];
  const canonTables = listUserTables(canonical);
  const targetTables = new Set(listUserTables(target));

  for (const table of canonTables) {
    if (!targetTables.has(table)) continue;

    const canonCols = getColumns(canonical, table);
    const targetCols = getColumns(target, table);
    const canonByName = new Map(canonCols.map((c) => [c.name, c]));
    const targetByName = new Map(targetCols.map((c) => [c.name, c]));
    const rowCount = getRowCount(target, table);

    for (const tCol of targetCols) {
      const cCol = canonByName.get(tCol.name);
      if (!cCol) {
        const nonNull = (
          target
            .prepare(`SELECT COUNT(*) AS c FROM "${table}" WHERE "${tCol.name}" IS NOT NULL`)
            .get() as { c: number }
        ).c;
        violations.push({
          kind: "dropped_column",
          table,
          column: tCol.name,
          nonNullRows: nonNull,
          message: `La tabla "${table}" eliminaría la columna "${tCol.name}" (${nonNull} filas con datos no nulos).`,
        });
        continue;
      }

      const fromType = tCol.type.trim().toLowerCase();
      const toType = cCol.type.trim().toLowerCase();
      if (fromType !== toType) {
        violations.push({
          kind: "type_change",
          table,
          column: tCol.name,
          fromType,
          toType,
          message: `La columna "${table}.${tCol.name}" cambia su tipo de "${fromType}" a "${toType}".`,
        });
      }
    }

    for (const cCol of canonCols) {
      if (targetByName.has(cCol.name)) continue;
      if (cCol.notnull === 1 && cCol.dflt_value === null && cCol.pk === 0 && rowCount > 0) {
        violations.push({
          kind: "not_null_without_default",
          table,
          column: cCol.name,
          rowCount,
          message: `La columna nueva "${table}.${cCol.name}" es NOT NULL sin DEFAULT y la tabla tiene ${rowCount} filas.`,
        });
      }
    }

    const newFks = getForeignKeys(canonical, table);
    for (const fk of newFks) {
      if (!targetByName.has(fk.from) || !targetTables.has(fk.table)) continue;
      const parentCols = new Set(getColumns(target, fk.table).map((c) => c.name));
      if (!parentCols.has(fk.to)) continue;

      const orphans = (
        target
          .prepare(
            `SELECT COUNT(*) AS c FROM "${table}" WHERE "${fk.from}" IS NOT NULL AND "${fk.from}" NOT IN (SELECT "${fk.to}" FROM "${fk.table}")`,
          )
          .get() as { c: number }
      ).c;

      if (orphans > 0) {
        violations.push({
          kind: "orphan_foreign_key",
          table,
          column: fk.from,
          refTable: fk.table,
          refColumn: fk.to,
          onDelete: fk.on_delete,
          orphanCount: orphans,
          message: `La tabla "${table}" tiene ${orphans} filas huérfanas en FK "${fk.from}" -> "${fk.table}.${fk.to}" (on_delete: ${fk.on_delete}).`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function parseAlignCliArgs(argv: string[]): {
  dbPath: string;
  strict: boolean;
  allowDestructive: boolean;
} {
  const allowDestructive = argv.includes("--allow-destructive");
  const strictFlag = argv.includes("--strict");
  const dbIdx = argv.indexOf("--db");
  let dbPath = "./database/mda.db";

  if (dbIdx >= 0 && argv[dbIdx + 1] && !argv[dbIdx + 1].startsWith("--")) {
    dbPath = argv[dbIdx + 1];
  } else {
    const positional = argv.find(
      (arg, idx) => !arg.startsWith("--") && (dbIdx < 0 || idx !== dbIdx + 1),
    );
    if (positional) dbPath = positional;
  }

  return {
    dbPath,
    strict: strictFlag && !allowDestructive,
    allowDestructive,
  };
}
