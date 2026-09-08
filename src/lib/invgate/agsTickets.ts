import { invgateGet, invgatePost } from "@lib/invgateClient";
import type { InvgateIncident, InvgateByStatusResponse } from "@/types/invgate";
import { getCategoryMap, getLastCategoryName } from "./categoryCache";
import { getFullUserMap } from "./userCache";
import { getHelpdeskMemberIdSet, getHelpdeskMemberMap, type HelpdeskMemberUser } from "./helpdeskMembersCache";
import { getLocationsMap } from "./locationsMapCache";

export interface CommentingOperator {
  id: number;
  name: string;
  username: string;
  comment_count: number;
  last_comment_at?: number;
}

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
      commenting_operators?: CommentingOperator[];
      commenting_operators_count?: number;
    }
  >;
  error?: string;
}

let unassignedTicketsCache: { data: UnassignedTicketsResult; timestamp: number } | null = null;
const UNASSIGNED_CACHE_TTL_MS = 25 * 1000; // 25 segundos

/**
 * Invalida el caché en memoria de tickets sin asignar de la mesa 3950.
 */
export function invalidateUnassignedTicketsCache(): void {
  unassignedTicketsCache = null;
}

/**
 * Trae los tickets sin asignar de una mesa de ayuda (por defecto ID 3950).
 */
export async function getUnassignedTicketsByHelpdesk(
  helpdeskId: number = 3950
): Promise<UnassignedTicketsResult> {
  const now = Date.now();
  if (helpdeskId === 3950 && unassignedTicketsCache && now - unassignedTicketsCache.timestamp < UNASSIGNED_CACHE_TTL_MS) {
    return unassignedTicketsCache.data;
  }

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
      const emptyResult: UnassignedTicketsResult = {
        ok: true,
        helpdeskId,
        tickets: [],
      };
      if (helpdeskId === 3950) {
        unassignedTicketsCache = { data: emptyResult, timestamp: now };
      }
      return emptyResult;
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

    // Resolver nombres de categorías, usuarios y ubicaciones en paralelo (sin N+1 de comentarios)
    const [catMap, fullUserMap, locMap] = await Promise.all([
      getCategoryMap(),
      getFullUserMap(),
      getLocationsMap(),
    ]);

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

    const result: UnassignedTicketsResult = {
      ok: true,
      helpdeskId,
      tickets: enrichedTickets,
    };

    if (helpdeskId === 3950) {
      unassignedTicketsCache = { data: result, timestamp: Date.now() };
    }

    return result;
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

export interface InvgateComment {
  id: number;
  incident_id: number;
  author_id: number;
  author_name?: string;
  author_username?: string;
  is_mda_agent?: boolean;
  message: string;
  created_at: number;
  customer_visible: boolean | number;
  is_solution?: boolean;
}

export interface TicketCommentsResult {
  ok: boolean;
  comments: InvgateComment[];
  commenting_operators: CommentingOperator[];
  message?: string;
}

const ticketCommentsCache = new Map<string, { data: TicketCommentsResult; timestamp: number }>();
const COMMENTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene los comentarios y notas internas de un ticket en InvGate enriquecidos con pertenencia a Mesa de Ayuda.
 * Endpoint: GET /incident.comment?request_id=X
 */
export async function getTicketComments(
  requestId: number,
  helpdeskId: number = 3950,
  creatorId?: number
): Promise<TicketCommentsResult> {
  const cacheKey = `${requestId}_${creatorId || 0}`;
  const now = Date.now();
  const cached = ticketCommentsCache.get(cacheKey);
  if (cached && now - cached.timestamp < COMMENTS_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const [res, userMap, mdaMemberIdSet, mdaMemberMap] = await Promise.all([
      invgateGet<any[]>(`incident.comment?request_id=${requestId}`),
      getFullUserMap().catch(() => new Map()),
      getHelpdeskMemberIdSet(helpdeskId).catch(() => new Set<number>()),
      getHelpdeskMemberMap(helpdeskId).catch(() => new Map<number, HelpdeskMemberUser>()),
    ]);

    if (!res.ok || !Array.isArray(res.data)) {
      return {
        ok: false,
        comments: [],
        commenting_operators: [],
        message: (!res.ok ? res.message : undefined) || "Error al obtener comentarios de InvGate",
      };
    }

    const operatorMap = new Map<number, CommentingOperator>();

    const comments: InvgateComment[] = res.data.map((c) => {
      const author = userMap.get(c.author_id);
      const mdaMember = mdaMemberMap.get(c.author_id);
      const isMdaAgent = mdaMemberIdSet.has(c.author_id);
      const authorFullName = mdaMember?.fullName || (author
        ? `${author.name || ""} ${author.lastname || ""}`.trim() || author.username || `Usuario #${c.author_id}`
        : `Usuario #${c.author_id}`);
      const cleanUsername = mdaMember?.username || (author?.username ? author.username.split("@")[0].toLowerCase().trim() : "");

      const isCreator = creatorId !== undefined && c.author_id === creatorId;
      if (isMdaAgent && !isCreator) {
        const existing = operatorMap.get(c.author_id);
        if (existing) {
          existing.comment_count += 1;
          existing.last_comment_at = Math.max(existing.last_comment_at || 0, c.created_at || 0);
        } else {
          operatorMap.set(c.author_id, {
            id: c.author_id,
            name: authorFullName,
            username: cleanUsername,
            comment_count: 1,
            last_comment_at: c.created_at || 0,
          });
        }
      }

      return {
        id: c.id,
        incident_id: c.incident_id,
        author_id: c.author_id,
        author_name: authorFullName,
        author_username: cleanUsername,
        is_mda_agent: isMdaAgent,
        message: c.message || "",
        created_at: c.created_at || 0,
        customer_visible: c.customer_visible,
        is_solution: c.is_solution,
      };
    });

    // Ordenar de más reciente a más antiguo
    comments.sort((a, b) => b.created_at - a.created_at);
    const commentingOperators = Array.from(operatorMap.values());

    const result: TicketCommentsResult = { ok: true, comments, commenting_operators: commentingOperators };
    ticketCommentsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err: any) {
    return {
      ok: false,
      comments: [],
      commenting_operators: [],
      message: err.message || "Error al conectar con InvGate",
    };
  }
}
