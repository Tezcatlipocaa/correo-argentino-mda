import { db } from "@/db";
import { automationParents } from "@/db/schema";
import { isActiveStatus } from "./automation-status";
import { listClosures } from "./closures";
import type { AutomationClosure } from "./closures";
import type { AutomationSummary } from "./discovery";
import { nowSeconds } from "./time";

/**
 * Historial persistente de padres de automatización. Alimenta el listado
 * completo de la vista de automatizaciones (creados y finalizados), a
 * diferencia de `automation_tracked_parents` que solo mantiene activos.
 *
 * Se puebla como side-effect del scan de discovery y nunca poda filas.
 */

export type AutomationParentRecord = typeof automationParents.$inferSelect;

/**
 * Inserta/actualiza los padres vistos en un scan. `firstSeenAt` solo se fija
 * al insertar; el resto de los campos se refresca en cada corrida.
 */
export function upsertAutomationParents(
  items: readonly AutomationSummary[],
): void {
  if (items.length === 0) {
    return;
  }

  const now = nowSeconds();

  try {
    db.transaction((tx) => {
      for (const item of items) {
        tx.insert(automationParents)
          .values({
            automationId: item.id,
            prettyId: item.prettyId,
            displayName: item.displayName,
            branchCode: item.branchCode,
            branchName: item.branchName,
            statusId: item.statusId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            closedAt: item.closedAt,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: automationParents.automationId,
            set: {
              prettyId: item.prettyId,
              displayName: item.displayName,
              branchCode: item.branchCode,
              branchName: item.branchName,
              statusId: item.statusId,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              closedAt: item.closedAt,
              lastSeenAt: now,
            },
          })
          .run();
      }
    });
  } catch {
    return;
  }
}

function toSummary(
  row: AutomationParentRecord,
  closure: AutomationClosure | undefined,
): AutomationSummary {
  if (closure) {
    return {
      id: row.automationId,
      prettyId: row.prettyId,
      branchCode: row.branchCode,
      branchName: row.branchName,
      displayName: row.displayName,
      statusId: row.statusId,
      isActive: false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      closedAt: closure.closedAt,
      localClosure: closure,
    };
  }

  return {
    id: row.automationId,
    prettyId: row.prettyId,
    branchCode: row.branchCode,
    branchName: row.branchName,
    displayName: row.displayName,
    statusId: row.statusId,
    isActive: isActiveStatus(row.statusId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
  };
}

/** Todos los padres vistos alguna vez, con cierres locales aplicados al vuelo. */
export function listAutomationParents(): AutomationSummary[] {
  try {
    const rows = db.select().from(automationParents).all();
    const closures = listClosures();
    return rows.map((row) => toSummary(row, closures.get(row.automationId)));
  } catch {
    return [];
  }
}
