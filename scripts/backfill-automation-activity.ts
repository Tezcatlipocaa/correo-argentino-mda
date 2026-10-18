import "dotenv/config";
import { db } from "@db/index";
import { automationParents } from "@db/schema";
import { getIncidentLinks } from "@lib/invgate/automation/links";
import { getIncidents } from "@lib/invgate/automation/incidents";
import { markActivityDays } from "@lib/workflow/activity-days";

/**
 * Backfill de `automation_activity_days`: deriva los días con actividad de cada
 * automatización a partir de las fechas reales del historial y del detalle en
 * InvGate (creación/última actualización/cierre del padre, creación y
 * comentarios de los hijos vinculados). Idempotente (no pisa días existentes).
 *
 * DRY-RUN por defecto; `--apply` escribe. Read-only contra InvGate (links +
 * bulk), sin disparar auto-cierres.
 *
 * Uso:
 *   npx tsx scripts/backfill-automation-activity.ts            # dry-run
 *   npx tsx scripts/backfill-automation-activity.ts --apply
 *   npx tsx scripts/backfill-automation-activity.ts --apply --limit=50
 */
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const limitArg = Number.parseInt(
  args.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? "",
  10,
);

interface ParentRow {
  automationId: number;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

function readParents(): ParentRow[] {
  return db
    .select({
      automationId: automationParents.automationId,
      createdAt: automationParents.createdAt,
      updatedAt: automationParents.updatedAt,
      closedAt: automationParents.closedAt,
    })
    .from(automationParents)
    .all();
}

/** Epochs con actividad de una automatización (padre + hijos + comentarios). */
async function collectActivityEpochs(row: ParentRow): Promise<number[]> {
  const epochs = new Set<number>([row.createdAt, row.updatedAt]);
  if (typeof row.closedAt === "number") epochs.add(row.closedAt);

  const links = await getIncidentLinks(row.automationId);
  if (!links.ok) return [...epochs];

  const ids = [row.automationId, ...links.data.map((link) => link.id)];
  const details = await getIncidents(ids, { includeComments: true });
  if (!details.ok) return [...epochs];

  for (const incident of Object.values(details.data)) {
    for (const value of [incident.created_at, incident.last_update, incident.closed_at]) {
      if (typeof value === "number" && value > 0) epochs.add(value);
    }
    for (const comment of incident.comments ?? []) {
      if (typeof comment.created_at === "number" && comment.created_at > 0) {
        epochs.add(comment.created_at);
      }
    }
  }

  return [...epochs];
}

async function main(): Promise<void> {
  let parents = readParents();
  if (Number.isInteger(limitArg) && limitArg > 0) {
    parents = parents.slice(0, limitArg);
  }

  console.log(
    `[backfill-automation-activity] ${apply ? "APPLY" : "DRY-RUN"} · ${parents.length} padres`,
  );

  let processed = 0;
  let failed = 0;
  let markedDays = 0;

  for (const row of parents) {
    let epochs: number[] = [];
    try {
      epochs = await collectActivityEpochs(row);
    } catch {
      failed += 1;
      continue;
    }
    const days = new Set(
      epochs.filter((value) => Number.isFinite(value) && value > 0),
    );
    markedDays += days.size;
    if (apply) {
      markActivityDays(row.automationId, [...days], "backfill");
    }
    processed += 1;
  }

  console.log(
    `  procesados ${processed} · fallidos ${failed} · días con actividad (aprox) ${markedDays}`,
  );
  if (!apply) {
    console.log("  (dry-run; usar --apply para escribir)");
  }
}

main().catch((error) => {
  console.error("[backfill-automation-activity] error", error);
  process.exitCode = 1;
});
