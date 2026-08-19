import { invgateGet, invgatePost } from "@lib/invgateClient";
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
 * Trae los tickets sin asignar de una mesa de ayuda (por defecto ID 3950).
 */
export async function getUnassignedTicketsByHelpdesk(
  helpdeskId: number = 3950
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

/**
 * Reasigna un ticket en InvGate a un agente específico.
 */
export async function reassignTicketToAgent(
  requestId: number,
  agentId: number,
  helpdeskId: number = 3950,
  authorId: number = 1
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await invgatePost<{ status: string; info?: string }>("incident.reassign", {
      request_id: requestId,
      author_id: authorId,
      group_id: helpdeskId,
      agent_id: agentId,
    });

    if (!res.ok) {
      return { ok: false, message: res.message };
    }

    if (res.data?.status === "ERROR") {
      return { ok: false, message: res.data.info || "Error al reasignar en InvGate" };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || "Error al conectar con InvGate" };
  }
}

/**
 * Pone un ticket de InvGate en estado "Esperando Fecha".
 * Endpoint: POST /incident.waitingfor.date
 */
export async function setTicketWaitingForDate(
  requestId: number,
  date: string | number,
  authorId: number = 1,
  reason: string = "Pospuesto por supervisión"
): Promise<{ ok: boolean; message?: string }> {
  try {
    let epochSeconds: number;
    if (typeof date === "number") {
      epochSeconds = date > 1e11 ? Math.floor(date / 1000) : date;
    } else {
      const str = String(date).trim();
      if (/^\d+$/.test(str)) {
        const num = Number(str);
        epochSeconds = num > 1e11 ? Math.floor(num / 1000) : num;
      } else {
        const parsed = new Date(str).getTime();
        if (isNaN(parsed)) {
          return { ok: false, message: `Fecha inválida para posponer: ${date}` };
        }
        epochSeconds = Math.floor(parsed / 1000);
      }
    }

    const res = await invgatePost<{ status: string; info?: string }>("incident.waitingfor.date", {
      request_id: requestId,
      timestamp: String(epochSeconds),
      author_id: authorId,
      reason,
    });

    if (!res.ok) {
      return { ok: false, message: res.message };
    }

    if (res.data?.status === "ERROR") {
      return { ok: false, message: res.data.info || "Error al cambiar estado a esperando fecha en InvGate" };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || "Error al conectar con InvGate" };
  }
}

/**
 * Agrega un comentario o nota interna a un ticket en InvGate.
 * Endpoint: POST /incident.comment
 * @param customerVisible 0 para nota interna (visible solo para operadores/agentes), 1 para público
 */
export async function addTicketComment(
  requestId: number,
  comment: string,
  authorId: number = 1,
  customerVisible: number = 0
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await invgatePost<{ status: string; error?: string }>("incident.comment", {
      request_id: requestId,
      author_id: authorId,
      comment,
      customer_visible: customerVisible,
    });

    if (!res.ok) {
      return { ok: false, message: res.message };
    }

    if (res.data?.status === "ERROR") {
      return { ok: false, message: res.data.error || "Error al agregar comentario en InvGate" };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || "Error al conectar con InvGate" };
  }
}


