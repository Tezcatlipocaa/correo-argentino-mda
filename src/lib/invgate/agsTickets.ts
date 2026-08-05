import { invgateGet } from "@lib/invgateClient";
import type { InvgateIncident, InvgateByStatusResponse } from "@/types/invgate";
import { getCategoryMap, getLastCategoryName } from "./categoryCache";
import { getFullUserMap } from "./userCache";

export interface UnassignedTicketsResult {
  ok: boolean;
  helpdeskId: number;
  tickets: Array<
    InvgateIncident & {
      category_name?: string;
      category_last_name?: string;
      creator_name?: string;
      creator_username?: string;
      customer_name?: string;
      customer_username?: string;
      location_name?: string;
    }
  >;
  error?: string;
}

/**
 * Trae los tickets sin asignar de una mesa de ayuda (por defecto ID 36).
 */
export async function getUnassignedTicketsByHelpdesk(
  helpdeskId: number = 36
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

    // Resolver nombres de categorías, usuarios y ubicaciones
    const [catMap, fullUserMap, locRes] = await Promise.all([
      getCategoryMap(),
      getFullUserMap(),
      invgateGet<InvgateLocation[]>("locations"),
    ]);

    const locMap = new Map<number, string>();
    if (locRes.ok && Array.isArray(locRes.data)) {
      for (const loc of locRes.data) {
        locMap.set(loc.id, loc.name);
      }
    }

    const enrichedTickets = allUnassigned.map((t) => {
      const catFullName = t.category_id ? catMap.get(t.category_id) || "" : "";
      const lastCatName = getLastCategoryName(catFullName);

      const creatorObj = t.creator_id ? fullUserMap.get(t.creator_id) : undefined;
      const customerObj = t.user_id ? fullUserMap.get(t.user_id) : undefined;

      const creatorName = creatorObj
        ? `${creatorObj.name || ""} ${creatorObj.lastname || ""}`.trim() || creatorObj.username || `Usuario #${t.creator_id}`
        : t.creator_id ? `Usuario #${t.creator_id}` : "";
      const creatorUsername = creatorObj?.username ? creatorObj.username.split("@")[0].toLowerCase().trim() : "";

      const customerName = customerObj
        ? `${customerObj.name || ""} ${customerObj.lastname || ""}`.trim() || customerObj.username || `Usuario #${t.user_id}`
        : t.user_id ? `Usuario #${t.user_id}` : "";
      const customerUsername = customerObj?.username ? customerObj.username.split("@")[0].toLowerCase().trim() : "";

      const locationName = t.location_id ? locMap.get(t.location_id) || `Ubicación #${t.location_id}` : "";

      return {
        ...t,
        category_name: catFullName,
        category_last_name: lastCatName || catFullName,
        creator_name: creatorName,
        creator_username: creatorUsername,
        customer_name: customerName,
        customer_username: customerUsername,
        location_name: locationName,
      };
    });

    return {
      ok: true,
      helpdeskId,
      tickets: enrichedTickets,
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
