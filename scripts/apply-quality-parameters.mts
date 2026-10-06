/**
 * apply-quality-parameters.mts — aplica la configuración de parámetros de
 * calidad (`src/data/quality-parameters.json`) sobre la tabla
 * `audit_parameters` de la base de datos (por ejemplo, en el servidor de
 * producción).
 *
 * Características:
 * - Idempotente: Matchea por `code`. Si existe, actualiza campos modificados;
 *   si no existe, lo inserta.
 * - Seguro (WAL-safe): En modo `--apply`, genera un backup completo con
 *   `db.backup()` antes de iniciar la transacción síncrona.
 * - Sin pérdida de datos: Nunca borra filas de `audit_parameters` para no romper
 *   claves foráneas de auditorías históricas; desactiva (`active = 0`) los que no
 *   correspondan.
 *
 * Uso:
 *   npx tsx scripts/apply-quality-parameters.mts            # Modo DRY-RUN (simulación)
 *   npx tsx scripts/apply-quality-parameters.mts --apply    # Aplica cambios con backup
 *   npx tsx scripts/apply-quality-parameters.mts --db <db>  # Especifica ruta a la DB
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";

interface JsonParam {
  code: string;
  name: string;
  weight: number | null;
  category: string;
  channel: string;
  section: string;
  order: number;
  active: boolean;
}

interface DbParamRow {
  id: number;
  code: string;
  name: string;
  weight: number | null;
  category: string;
  channel: string;
  section: string;
  order: number;
  active: number;
}

function backupNameFor(dbBasename: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "_");
  return `${dbBasename}.${ts}.wal-backup`;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");

  const dbFlag = args.indexOf("--db");
  const dbPath = resolve(
    dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db",
  );

  const inFlag = args.indexOf("--in");
  const inPath = resolve(
    inFlag >= 0 && args[inFlag + 1]
      ? args[inFlag + 1]
      : "./src/data/quality-parameters.json",
  );

  console.log("==========================================================");
  console.log("   SINCRONIZACIÓN DE PARÁMETROS DE CALIDAD (LOCAL -> PROD)");
  console.log("==========================================================");
  console.log(
    `Modo:         ${isApply ? "APPLY (Escritura real con backup)" : "DRY-RUN (Simulación sin cambios)"}`,
  );
  console.log(`Base de datos: ${dbPath}`);
  console.log(`Archivo dump:  ${inPath}\n`);

  if (!existsSync(dbPath)) {
    console.error(`Error: No existe la base de datos en: ${dbPath}`);
    process.exit(1);
  }

  if (!existsSync(inPath)) {
    console.error(`Error: No existe el archivo dump en: ${inPath}`);
    process.exit(1);
  }

  const rawJson = readFileSync(inPath, "utf-8").replace(/^\uFEFF/, "");
  const payload = JSON.parse(rawJson) as {
    generatedAt: string;
    count: number;
    activeCount: number;
    parameters: JsonParam[];
  };

  const db = new Database(dbPath, { readonly: !isApply });

  try {
    const existingRows = db
      .prepare(
        `SELECT id, code, name, weight, category, channel, section, [order], active
         FROM audit_parameters`,
      )
      .all() as DbParamRow[];

    const existingByCode = new Map<string, DbParamRow>(
      existingRows.map((r) => [r.code, r]),
    );

    const toInsert: JsonParam[] = [];
    const toUpdate: { id: number; param: JsonParam }[] = [];
    const toDeactivate: DbParamRow[] = [];

    const jsonCodes = new Set(payload.parameters.map((p) => p.code));

    for (const p of payload.parameters) {
      const existing = existingByCode.get(p.code);
      if (!existing) {
        toInsert.push(p);
      } else {
        const needsUpdate =
          existing.name !== p.name ||
          existing.weight !== p.weight ||
          existing.category !== p.category ||
          existing.channel !== p.channel ||
          existing.section !== p.section ||
          existing.order !== p.order ||
          (existing.active === 1) !== p.active;

        if (needsUpdate) {
          toUpdate.push({ id: existing.id, param: p });
        }
      }
    }

    // Identificar parámetros en la DB destino que no están en el dump o deben desactivarse
    for (const r of existingRows) {
      if (!jsonCodes.has(r.code) && r.active === 1) {
        toDeactivate.push(r);
      }
    }

    console.log(
      `Parámetros en archivo dump: ${payload.parameters.length} (${payload.activeCount} activos)`,
    );
    console.log(`Parámetros actuales en DB:  ${existingRows.length}\n`);

    console.log(`- Nuevos a insertar:     ${toInsert.length}`);
    console.log(`- Existentes a actualizar: ${toUpdate.length}`);
    console.log(`- Obsoletos a desactivar:  ${toDeactivate.length}\n`);

    if (toInsert.length > 0) {
      console.log("=== Parámetros a INSERTAR ===");
      for (const p of toInsert) {
        console.log(
          `  + [${p.channel}] ${p.code} (${p.section}) - "${p.name}" (peso: ${p.weight ?? "n/a"}, activo: ${p.active ? "sí" : "no"})`,
        );
      }
      console.log("");
    }

    if (toUpdate.length > 0) {
      console.log("=== Parámetros a ACTUALIZAR ===");
      for (const u of toUpdate) {
        const existing = existingByCode.get(u.param.code)!;
        console.log(
          `  ~ [${u.param.channel}] ${u.param.code}: "${existing.name}" -> "${u.param.name}" (peso: ${existing.weight} -> ${u.param.weight}, activo: ${existing.active === 1 ? "sí" : "no"} -> ${u.param.active ? "sí" : "no"})`,
        );
      }
      console.log("");
    }

    if (toDeactivate.length > 0) {
      console.log("=== Parámetros a DESACTIVAR (no presentes en el dump) ===");
      for (const d of toDeactivate) {
        console.log(`  - [${d.channel}] ${d.code}: "${d.name}"`);
      }
      console.log("");
    }

    if (toInsert.length === 0 && toUpdate.length === 0 && toDeactivate.length === 0) {
      console.log("La base de datos ya está 100% sincronizada con los parámetros del dump.");
      return;
    }

    if (isApply) {
      const backupPath = join(dirname(dbPath), backupNameFor(basename(dbPath)));
      console.log(`Creando backup WAL-safe en: ${backupPath}...`);
      await db.backup(backupPath);
      console.log("Backup completado.\n");

      console.log("Aplicando cambios en transacción síncrona...");

      const insertStmt = db.prepare(`
        INSERT INTO audit_parameters (
          code, name, weight, category, channel, section, [order], active
        ) VALUES (
          @code, @name, @weight, @category, @channel, @section, @order, @active
        )
      `);

      const updateStmt = db.prepare(`
        UPDATE audit_parameters
        SET name = @name,
            weight = @weight,
            category = @category,
            channel = @channel,
            section = @section,
            [order] = @order,
            active = @active
        WHERE id = @id
      `);

      const deactivateStmt = db.prepare(`
        UPDATE audit_parameters
        SET active = 0
        WHERE id = ?
      `);

      const applyTx = db.transaction(() => {
        for (const p of toInsert) {
          insertStmt.run({
            code: p.code,
            name: p.name,
            weight: p.weight,
            category: p.category,
            channel: p.channel,
            section: p.section,
            order: p.order,
            active: p.active ? 1 : 0,
          });
        }

        for (const u of toUpdate) {
          updateStmt.run({
            id: u.id,
            name: u.param.name,
            weight: u.param.weight,
            category: u.param.category,
            channel: u.param.channel,
            section: u.param.section,
            order: u.param.order,
            active: u.param.active ? 1 : 0,
          });
        }

        for (const d of toDeactivate) {
          deactivateStmt.run(d.id);
        }
      });

      applyTx();

      console.log("==========================================================");
      console.log("      PARÁMETROS SINCRONIZADOS EXITOSAMENTE EN LA DB      ");
      console.log("==========================================================");
      console.log(`Insertados:   ${toInsert.length}`);
      console.log(`Actualizados: ${toUpdate.length}`);
      console.log(`Desactivados: ${toDeactivate.length}`);
      console.log(`Backup en:    ${backupPath}`);
      console.log("==========================================================\n");
    } else {
      console.log("==========================================================");
      console.log("  MODO DRY-RUN FINALIZADO: NO SE ESCRIBIÓ EN LA BASE DE DATOS");
      console.log("  Para aplicar los cambios en la base de datos, ejecuta:");
      console.log("  npx tsx scripts/apply-quality-parameters.mts --apply");
      console.log("==========================================================\n");
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error("Error al sincronizar parámetros de calidad:", err);
  process.exit(1);
});
