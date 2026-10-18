import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { automationActivityDays } from "@/db/schema";
import { nowSeconds } from "./time";

/**
 * Días con actividad de una automatización. Una fila por (automatización, día
 * local) en que hubo movimiento. Es la base de "tiempo trabajado" (días activos)
 * y "días sin actividad". Nunca poda: el histórico arranca en la implantación y
 * en el backfill.
 *
 * Nunca lanza: ante error de DB degrada silenciosamente para no romper el scan
 * ni las métricas.
 */

/** Clave de día local `YYYY-MM-DD` de un epoch en segundos. */
export function dayKey(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type ActivitySource = "scan" | "backfill";

/** Marca un día con actividad (idempotente por PK compuesta). */
export function markActivityDay(
  automationId: number,
  epochSeconds: number,
  source: ActivitySource = "scan",
): void {
  if (!Number.isInteger(automationId) || epochSeconds <= 0) return;
  try {
    db.insert(automationActivityDays)
      .values({
        automationId,
        day: dayKey(epochSeconds),
        source,
        firstSeenAt: nowSeconds(),
      })
      .onConflictDoNothing()
      .run();
  } catch {
    return;
  }
}

/** Marca varios días con actividad en una sola transacción. */
export function markActivityDays(
  automationId: number,
  epochSecondsList: readonly number[],
  source: ActivitySource = "scan",
): void {
  const days = new Set(
    epochSecondsList
      .filter((value) => Number.isFinite(value) && value > 0)
      .map(dayKey),
  );
  if (days.size === 0) return;
  try {
    const seenAt = nowSeconds();
    db.transaction((tx) => {
      for (const day of days) {
        tx.insert(automationActivityDays)
          .values({ automationId, day, source, firstSeenAt: seenAt })
          .onConflictDoNothing()
          .run();
      }
    });
  } catch {
    return;
  }
}

/** Días con actividad (ordenados) de una automatización. */
export function listActivityDays(automationId: number): string[] {
  try {
    return db
      .select({ day: automationActivityDays.day })
      .from(automationActivityDays)
      .where(eq(automationActivityDays.automationId, automationId))
      .orderBy(asc(automationActivityDays.day))
      .all()
      .map((row) => row.day);
  } catch {
    return [];
  }
}

/** Cantidad de días activos por automatización (para las métricas). */
export function countActiveDaysByAutomation(): Map<number, number> {
  try {
    const rows = db
      .select({
        automationId: automationActivityDays.automationId,
        value: count(),
      })
      .from(automationActivityDays)
      .groupBy(automationActivityDays.automationId)
      .all();
    return new Map(rows.map((row) => [row.automationId, row.value]));
  } catch {
    return new Map();
  }
}

/** Total de filas (diagnóstico). */
export function countActivityDayRows(): number {
  try {
    return (
      db.select({ value: count() }).from(automationActivityDays).get()?.value ??
      0
    );
  } catch {
    return 0;
  }
}

/** Último día con actividad de una automatización (o null). */
export function lastActivityDay(automationId: number): string | null {
  try {
    const row = db
      .select({ day: sql<string | null>`max(${automationActivityDays.day})` })
      .from(automationActivityDays)
      .where(eq(automationActivityDays.automationId, automationId))
      .get();
    return row?.day ?? null;
  } catch {
    return null;
  }
}
