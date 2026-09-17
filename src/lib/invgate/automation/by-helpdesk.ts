import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";

const BY_HELPDESK_ENDPOINT = "incidents.by.helpdesk";
const PAGE_SIZE = 500;
/** Guardia: una cola correcta contiene cientos de tickets, no decenas de miles. */
const MAX_IDS = 5000;

/**
 * Envelope de /incidents.by.helpdesk validado en producción (2026-09):
 * {status, info, requestIds[]} — SIN total/limit/offset en la respuesta.
 * El id correcto es el NIVEL del helpdesk (helpdesksandlevels type_id=1),
 * no el helpdesk en sí (con el helpdesk la respuesta viene vacía).
 */
interface InvgateIncidentsByHelpdeskResponse {
  status: "OK" | "ERROR";
  info: string;
  requestIds: number[];
}

/**
 * Lista los IDs de tickets de una cola (nivel) de helpdesk. La paginación
 * por offset se recorre de forma defensiva: la respuesta no informa total,
 * así que se itera hasta una página parcial o hasta el guardia de volumen.
 */
export async function getIncidentIdsByHelpdesk(
  helpdeskId: number,
): Promise<InvgateResult<number[]>> {
  const ids: number[] = [];
  let offset = 0;

  while (true) {
    const search = new URLSearchParams({
      helpdesk_id: String(helpdeskId),
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    const result = await invgateGet<InvgateIncidentsByHelpdeskResponse>(
      `${BY_HELPDESK_ENDPOINT}?${search.toString()}`,
    );

    if (!result.ok) {
      return result;
    }

    const pageIds = Array.isArray(result.data.requestIds)
      ? result.data.requestIds
      : [];
    ids.push(...pageIds);

    if (ids.length > MAX_IDS) {
      return {
        ok: false,
        status: result.status,
        message: `La cola ${helpdeskId} devuelve más de ${MAX_IDS} tickets: verificá el nivel configurado (helpdesksandlevels).`,
      };
    }

    if (pageIds.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return { ok: true, status: 200, data: ids };
}
