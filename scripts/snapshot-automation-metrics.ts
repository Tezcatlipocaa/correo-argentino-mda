import "dotenv/config";
import { db } from "@db/index";
import { automationMetricsMonthly, automationParents } from "@db/schema";
import {
  computeMonthlySnapshot,
  type MetricsParentRow,
  type MonthlySnapshot,
} from "@lib/workflow/metrics";
import { listClosures } from "@lib/workflow/closures";

/**
 * Snapshot mensual de KPIs de /automatizaciones. Idempotente (upsert por mes),
 * no borra datos; se puede recomputar en cualquier momento. Corre como worker
 * PM2 diario (cron 04:05) para conservar series históricas estables.
 *
 * DRY-RUN por defecto; `--apply` escribe.
 *
 * Uso:
 *   npx tsx scripts/snapshot-automation-metrics.ts                 # dry-run (mes actual + anterior)
 *   npx tsx scripts/snapshot-automation-metrics.ts --apply
 *   npx tsx scripts/snapshot-automation-metrics.ts --month=2026-09 # un mes puntual
 */
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const monthArg = args.find((arg) => arg.startsWith("--month="))?.slice(8);

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function targetMonths(): string[] {
  if (monthArg) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthArg)) {
      throw new Error(`Mes inválido: ${monthArg} (esperado YYYY-MM)`);
    }
    return [monthArg];
  }
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [monthKey(previous), monthKey(now)];
}

function readRows(): MetricsParentRow[] {
  return db
    .select({
      automationId: automationParents.automationId,
      displayName: automationParents.displayName,
      branchCode: automationParents.branchCode,
      branchName: automationParents.branchName,
      statusId: automationParents.statusId,
      createdAt: automationParents.createdAt,
      updatedAt: automationParents.updatedAt,
      closedAt: automationParents.closedAt,
      estimatedEndAt: automationParents.estimatedEndAt,
      region: automationParents.region,
      assignedGroupName: automationParents.assignedGroupName,
      progressPercent: automationParents.progressPercent,
      reopenCount: automationParents.reopenCount,
    })
    .from(automationParents)
    .all();
}

function upsert(snapshot: MonthlySnapshot): void {
  const values = { ...snapshot, snapshotAt: Math.floor(Date.now() / 1000) };
  db.insert(automationMetricsMonthly)
    .values(values)
    .onConflictDoUpdate({
      target: automationMetricsMonthly.month,
      set: {
        created: values.created,
        finalized: values.finalized,
        finalizedByPortal: values.finalizedByPortal,
        activeAtMonthEnd: values.activeAtMonthEnd,
        medianLeadDays: values.medianLeadDays,
        p90LeadDays: values.p90LeadDays,
        onTimeRate: values.onTimeRate,
        snapshotAt: values.snapshotAt,
      },
    })
    .run();
}

function main(): void {
  const rows = readRows();
  const closures = listClosures();
  const months = targetMonths();

  console.log(
    `[snapshot-automation-metrics] ${apply ? "APPLY" : "DRY-RUN"} · ${rows.length} padres · meses: ${months.join(", ")}`,
  );

  for (const month of months) {
    const snapshot = computeMonthlySnapshot(rows, closures, month);
    console.log(
      `  ${month}: creados ${snapshot.created} · finalizados ${snapshot.finalized} (portal ${snapshot.finalizedByPortal}) · activos al cierre ${snapshot.activeAtMonthEnd} · mediana ${snapshot.medianLeadDays} · p90 ${snapshot.p90LeadDays} · on-time ${snapshot.onTimeRate}`,
    );
    if (apply) {
      upsert(snapshot);
    }
  }

  if (!apply) {
    console.log("  (dry-run; usar --apply para escribir)");
  }
}

try {
  main();
} catch (error) {
  console.error("[snapshot-automation-metrics] error", error);
  process.exitCode = 1;
}
