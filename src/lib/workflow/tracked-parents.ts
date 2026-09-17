import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { automationTrackedParents } from "@/db/schema";
import { invgateGet } from "@lib/invgateClient";
import { getIncidents } from "@lib/invgate/automation/incidents";
import { isActiveStatus } from "./automation-status";
import { nowSeconds } from "./time";

/**
 * Tracking persistido de padres de automatización. El workflow reasigna el
 * padre a otras mesas y sale de las colas resueltas; este set lo mantiene
 * visible en el portal aunque cambie de `assigned_group_id`. Solo guarda
 * padres activos: se poda al finalizar.
 */
export interface TrackedParent {
  automationId: number;
  lastStatusId: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export function listTrackedParents(): Map<number, TrackedParent> {
  try {
    const rows = db.select().from(automationTrackedParents).all();
    return new Map(rows.map((row) => [row.automationId, row]));
  } catch {
    return new Map();
  }
}

export function upsertTrackedParents(
  entries: readonly { automationId: number; statusId: number }[],
): void {
  if (entries.length === 0) {
    return;
  }

  const now = nowSeconds();

  try {
    db.transaction((tx) => {
      for (const entry of entries) {
        tx
          .insert(automationTrackedParents)
          .values({
            automationId: entry.automationId,
            lastStatusId: entry.statusId,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: automationTrackedParents.automationId,
            set: { lastStatusId: entry.statusId, lastSeenAt: now },
          })
          .run();
      }
    });
  } catch {
    return;
  }
}

export function removeTrackedParents(ids: readonly number[]): void {
  if (ids.length === 0) {
    return;
  }
  try {
    db.delete(automationTrackedParents)
      .where(inArray(automationTrackedParents.automationId, [...ids]))
      .run();
  } catch {
    return;
  }
}

interface ByStatusResponse {
  status?: string;
  requestIds?: number[];
}

export interface ReconcileTrackedResult {
  activeParents: number;
  tracked: number;
}

/**
 * Reconstruye el tracking desde el estado actual de InvGate: busca TODOS los
 * incidentes activos (status 1-4) —sin importar la mesa— y conserva los que
 * pertenecen a la categoría de automatizaciones. Recupera padres que se
 * reasignaron a otra mesa antes de haber sido trackeados.
 *
 * `/incidents.by.status` devuelve la lista completa de IDs en una sola llamada
 * (ignora page_size); el bulk se resuelve en chunks.
 */
export async function reconcileTrackedParentsFromStatuses(
  categoryId: number,
): Promise<ReconcileTrackedResult> {
  const result = await invgateGet<ByStatusResponse>(
    "incidents.by.status?status_ids[]=1&status_ids[]=2&status_ids[]=3&status_ids[]=4&page=1&page_size=500",
  );

  if (!result.ok) {
    throw new Error(result.message);
  }

  const activeIds = Array.isArray(result.data?.requestIds)
    ? result.data.requestIds
    : [];

  const details = await getIncidents(activeIds);
  if (!details.ok) {
    throw new Error(details.message);
  }

  const parents = Object.values(details.data).filter(
    (incident) =>
      incident &&
      incident.category_id === categoryId &&
      isActiveStatus(incident.status_id),
  );

  const keepIds = new Set(parents.map((parent) => parent.id));
  const existing = listTrackedParents();
  removeTrackedParents(
    [...existing.keys()].filter((id) => !keepIds.has(id)),
  );
  upsertTrackedParents(
    parents.map((parent) => ({
      automationId: parent.id,
      statusId: parent.status_id,
    })),
  );

  return { activeParents: parents.length, tracked: keepIds.size };
}
