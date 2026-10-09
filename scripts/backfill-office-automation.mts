import Database from "better-sqlite3";
import { existsSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { pathToFileURL } from "url";
import { hasMosaicIndicator } from "../src/lib/officeHelpers";

type OfficeRow = {
  id: number;
  code: string;
  name: string;
  type: string;
  officeType: string | null;
  invgateDisplayName: string | null;
};

export type OfficeAutomationChange = {
  id: number;
  code: string;
  name: string;
  type: string;
  reason: "mosaic_name" | "mosaic_invgate" | "normalize_format";
  beforeOfficeType: string | null;
  afterOfficeType: "AUTOMATIZADA" | "NO_AUTOMATIZADA";
};

export type BackfillOfficeAutomationReport = {
  totalOffices: number;
  totalSucursales: number;
  mosaicAutomated: number;
  normalizedNoAuto: number;
  updated: number;
  changes: OfficeAutomationChange[];
  backupPath: string | null;
  applied: boolean;
};

type BackupFn = (db: Database.Database, dest: string) => Promise<void>;

const defaultBackup: BackupFn = async (db, dest) => {
  await db.backup(dest);
};

function backupNameFor(dbBasename: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${dbBasename}.${ts}.pre-office-automation.bak`;
}

const SELECT_OFFICES = `
  SELECT
    o.id,
    o.code,
    o.name,
    o.type,
    o.officeType,
    l.invgate_display_name AS invgateDisplayName
  FROM offices o
  LEFT JOIN office_invgate_links l ON o.id = l.office_id
`;

const UPDATE_OFFICE_TYPE = `
  UPDATE offices
  SET officeType = ?
  WHERE id = ?
`;

export async function runBackfillOfficeAutomation(opts: {
  dbPath: string;
  apply?: boolean;
  backupFn?: BackupFn;
}): Promise<BackfillOfficeAutomationReport> {
  const dbPath = resolve(opts.dbPath);
  const apply = opts.apply === true;
  if (!existsSync(dbPath)) {
    throw new Error(`No existe la DB: ${dbPath}`);
  }

  const db = apply ? new Database(dbPath) : new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare(SELECT_OFFICES).all() as OfficeRow[];

    const changes: OfficeAutomationChange[] = [];
    const pending: Array<{ id: number; after: "AUTOMATIZADA" | "NO_AUTOMATIZADA" }> = [];

    let totalSucursales = 0;
    let mosaicAutomated = 0;
    let normalizedNoAuto = 0;

    for (const r of rows) {
      if (r.type?.toUpperCase() !== "SUCURSAL") continue;
      totalSucursales++;

      const isCurrentAuto = r.officeType?.toUpperCase() === "AUTOMATIZADA";
      const hasMosaic = hasMosaicIndicator(r.name, r.invgateDisplayName);

      if (!isCurrentAuto && hasMosaic) {
        const reason = hasMosaicIndicator(r.name) ? "mosaic_name" : "mosaic_invgate";
        changes.push({
          id: r.id,
          code: r.code,
          name: r.name,
          type: r.type,
          reason,
          beforeOfficeType: r.officeType,
          afterOfficeType: "AUTOMATIZADA",
        });
        pending.push({ id: r.id, after: "AUTOMATIZADA" });
        mosaicAutomated++;
      } else if (!isCurrentAuto && !hasMosaic) {
        if (r.officeType !== "NO_AUTOMATIZADA") {
          changes.push({
            id: r.id,
            code: r.code,
            name: r.name,
            type: r.type,
            reason: "normalize_format",
            beforeOfficeType: r.officeType,
            afterOfficeType: "NO_AUTOMATIZADA",
          });
          pending.push({ id: r.id, after: "NO_AUTOMATIZADA" });
          normalizedNoAuto++;
        }
      }
    }

    let updated = 0;
    let backupPath: string | null = null;

    if (apply && pending.length > 0) {
      backupPath = join(dirname(dbPath), backupNameFor(basename(dbPath)));
      try {
        await (opts.backupFn ?? defaultBackup)(db, backupPath);
      } catch (e) {
        throw new Error(
          `No se pudo crear el backup en ${backupPath}: ${(e as Error).message}. Abortado, sin cambios.`,
        );
      }

      const stmt = db.prepare(UPDATE_OFFICE_TYPE);
      const tx = db.transaction((items: typeof pending) => {
        for (const it of items) stmt.run(it.after, it.id);
      });
      tx(pending);
      updated = pending.length;
    }

    return {
      totalOffices: rows.length,
      totalSucursales,
      mosaicAutomated,
      normalizedNoAuto,
      updated,
      changes,
      backupPath,
      applied: apply,
    };
  } finally {
    db.close();
  }
}

async function cli(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const dbIdx = argv.indexOf("--db");
  const dbPath = dbIdx >= 0 && argv[dbIdx + 1] ? argv[dbIdx + 1] : "database/mda.db";

  console.log(`[backfill-office-automation] Modo: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[backfill-office-automation] DB: ${resolve(dbPath)}`);

  const report = await runBackfillOfficeAutomation({ dbPath, apply });

  console.log(`\n--- Resumen ---`);
  console.log(`Total oficinas: ${report.totalOffices}`);
  console.log(`Total sucursales: ${report.totalSucursales}`);
  console.log(`Sucursales con Mosaic detectadas para AUTOMATIZADA: ${report.mosaicAutomated}`);
  console.log(`Sucursales a normalizar a NO_AUTOMATIZADA: ${report.normalizedNoAuto}`);
  console.log(`Total cambios pendientes: ${report.changes.length}`);

  if (report.changes.length > 0) {
    console.log(`\n--- Detalle de sucursales con Mosaic que pasan a AUTOMATIZADA ---`);
    for (const c of report.changes.filter((c) => c.afterOfficeType === "AUTOMATIZADA")) {
      console.log(
        `  - [${c.code}] ${c.name} (motivo: ${c.reason}, antes: ${c.beforeOfficeType ?? "NULL"} -> después: ${c.afterOfficeType})`,
      );
    }
  }

  if (apply) {
    console.log(`\nBackup creado: ${report.backupPath}`);
    console.log(`Filas actualizadas: ${report.updated}`);
  } else {
    console.log(
      `\nDry-run finalizado sin escrituras. Para aplicar cambios ejecutar con --apply.`,
    );
  }
}

const isEntrypoint =
  process.argv[1] &&
  (resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname) ||
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url);

if (isEntrypoint) {
  cli().catch((err) => {
    console.error(`[backfill-office-automation] Error:`, err);
    process.exit(1);
  });
}
