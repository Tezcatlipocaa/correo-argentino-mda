import { invgateGet } from "@lib/invgateClient";
import type { InvgateIncident, InvgateByStatusResponse } from "@/types/invgate";

export interface UnassignedTicketsResult {
  ok: boolean;
  helpdeskId: number;
  tickets: InvgateIncident[];
  error?: string;
}

/**
 * Trae los tickets sin asignar de una mesa de ayuda (por defecto ID 2510).
 */
export async function getUnassignedTicketsByHelpdesk(
  helpdeskId: number = 2510
): Promise<UnassignedTicketsResult> {
  try {
    // 1. Obtener IDs de incidentes abiertos de la mesa de ayuda
    const helpdeskRes = await invgateGet<InvgateByStatusResponse>(
      `incidents.by.helpdesk?helpdesk_id=${helpdeskId}`
    );

    if (!helpdeskRes.ok) {
      return {
        ok: false,
        helpdeskId,
        tickets: [],
        error: helpdeskRes.message,
      };
    }

    const requestIds = helpdeskRes.data.requestIds ?? [];
    if (requestIds.length === 0) {
      return {
        ok: true,
        helpdeskId,
        tickets: [],
      };
    }

    // 2. Batch fetch de objetos completos de incidentes via PHP array params (?ids[]=1&ids[]=2...)
    const batchSize = 50;
    const allUnassigned: InvgateIncident[] = [];

    for (let i = 0; i < requestIds.length; i += batchSize) {
      const batchIds = requestIds.slice(i, i + batchSize);
      const queryParams = batchIds.map((id) => `ids[]=${id}`).join("&");
      
      const batchRes = await invgateGet<Record<string, InvgateIncident>>(
        `incidents?${queryParams}`
      );

      if (batchRes.ok && batchRes.data) {
        const incidentsMap = batchRes.data;
        const unassignedInBatch = Object.values(incidentsMap).filter(
          (inc) => !inc.assigned_id
        );
        allUnassigned.push(...unassignedInBatch);
      }
    }

    // Ordenar por fecha de creación (más antiguos primero)
    allUnassigned.sort((a, b) => a.created_at - b.created_at);

    return {
      ok: true,
      helpdeskId,
      tickets: allUnassigned,
    };
  } catch (err: any) {
    return {
      ok: false,
      helpdeskId,
      tickets: [],
      error: err.message || "Error desconocido al consultar InvGate",
    };
  }
}
