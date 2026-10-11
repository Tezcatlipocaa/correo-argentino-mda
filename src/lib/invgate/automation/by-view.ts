import { invgateGet } from "@lib/invgateClient";
import { getServerEnv } from "@lib/invgate/automation/env";
import type { InvgateResult } from "@/types/invgate";

const BY_VIEW_ENDPOINT = "incidents.by.view";
const PAGE_SIZE = 500;
/** Guardia: una vista de categoría de automatizaciones no supera esto. */
const MAX_IDS = 5000;

/**
 * Envelope de /incidents.by.view validado en producción (2026-10, view 64):
 * {status, info, requestIds[], limit, offset} — SIN total; paginar por offset
 * de forma defensiva hasta página parcial (mismo patrón que by.helpdesk).
 */
interface InvgateIncidentsByViewResponse {
  status: "OK" | "ERROR";
  info: string;
  requestIds: number[];
}

/**
 * ID de la vista guardada de InvGate filtrada SOLO por la categoría hoja de
 * automatizaciones (todos los estados). Fuente autoritativa por categoría:
 * cubre padres asignados a cualquier mesa, incluidos los finalizados.
 */
export function getAutomationViewId(): number | null {
  const raw = Number.parseInt(getServerEnv("INVGATE_AUTOMATION_VIEW_ID"), 10);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

/** Lista los IDs de tickets de una vista guardada (paginado defensivo). */
export async function getIncidentIdsByView(
  viewId: number,
): Promise<InvgateResult<number[]>> {
  const ids: number[] = [];
  let offset = 0;

  while (true) {
    const search = new URLSearchParams({
      view_id: String(viewId),
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    const result = await invgateGet<InvgateIncidentsByViewResponse>(
      `${BY_VIEW_ENDPOINT}?${search.toString()}`,
    );

    if (!result.ok) {
      return result;
    }

    const pageIds = Array.isArray(result.data?.requestIds)
      ? result.data.requestIds
      : [];
    ids.push(...pageIds);

    if (ids.length > MAX_IDS) {
      return {
        ok: false,
        status: result.status,
        message: `La vista ${viewId} devuelve más de ${MAX_IDS} tickets: verificá el filtro de la vista.`,
      };
    }

    if (pageIds.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return { ok: true, status: 200, data: ids };
}
