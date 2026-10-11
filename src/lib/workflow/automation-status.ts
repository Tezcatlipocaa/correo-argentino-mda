/**
 * Semántica de negocio de estados de automatizaciones.
 * Fuente: GET /incident.attributes.status validado contra QA (2026-08).
 */

import type { InvgateStatus } from "@lib/invgate/automation/statuses";

export const ACTIVE_STATUS_IDS = [1, 2, 3, 4] as const;
export const FINALIZED_STATUS_IDS = [5, 6, 7, 8] as const;

/** Nombres validados empíricamente; usado como fallback si falla la llamada dinámica. */
export const STATUS_NAME_FALLBACK: Readonly<Record<number, string>> = {
  1: "Nuevo",
  2: "Abierto",
  3: "Pendiente",
  4: "En espera",
  5: "Solucionado",
  6: "Cerrado",
  7: "Rechazado",
  8: "Cancelado",
};

export function isActiveStatus(statusId: number): boolean {
  return (ACTIVE_STATUS_IDS as readonly number[]).includes(statusId);
}

export function isFinalizedStatus(statusId: number): boolean {
  return (FINALIZED_STATUS_IDS as readonly number[]).includes(statusId);
}

/**
 * Mapa de nombres visibles combinando el fallback estático con los datos
 * dinámicos de GET /incident.attributes.status (si están disponibles).
 */
export function buildStatusNameLookup(
  dynamicStatuses: readonly InvgateStatus[] | null,
): Record<number, string> {
  const lookup: Record<number, string> = {};

  for (const [rawId, name] of Object.entries(STATUS_NAME_FALLBACK)) {
    lookup[Number(rawId)] = name;
  }

  if (dynamicStatuses) {
    for (const status of dynamicStatuses) {
      lookup[status.id] = status.name;
    }
  }

  return lookup;
}

/** Etiqueta de negocio para el badge principal (no confundir con el estado InvGate crudo). */
export function resolveLifecycleLabel(
  statusId: number,
  hasClosure = false,
): "En curso" | "Finalizada" {
  return hasClosure || isFinalizedStatus(statusId) ? "Finalizada" : "En curso";
}

