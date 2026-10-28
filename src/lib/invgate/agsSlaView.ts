import { invgateGet } from "@lib/invgateClient";
import type { InvgateIncident } from "@/types/invgate";

/**
 * Vista guardada de InvGate con los tickets de autogestión que están esperando
 * a un agente y tienen al menos un SLA corriendo. Es la fuente de la feature de
 * postergación manual: el filtro vive en InvGate, no en el portal.
 *
 * Se resuelve por entorno (`INVGATE_AGS_SLA_VIEW_ID`). Default 83 (producción);
 * QA puede apuntar a otra vista sin tocar código.
 */
function readSlaViewIdFromEnv(): number {
  // Runtime-first (PM2/server.mjs con dotenv) y, si no existe, import.meta.env:
  // `astro dev` NO puebla process.env desde .env, solo import.meta.env.
  const raw =
    process.env.INVGATE_AGS_SLA_VIEW_ID ||
    (typeof import.meta !== "undefined" ? (import.meta.env as any)?.INVGATE_AGS_SLA_VIEW_ID : "");
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    console.warn(
      `[agsSlaView] INVGATE_AGS_SLA_VIEW_ID inválido ('${raw}'); se usa 83.`
    );
  }
  return 83;
}

export const AGS_SLA_VIEW_ID: number = readSlaViewIdFromEnv();

const MAX_PAGES = 10; // tope de seguridad: la vista no debería superar esto
const SLA_BATCH_SIZE = 50;
const CACHE_TTL_MS = 25 * 1000; // 25 segundos

interface DetailsByViewRow {
  id: number;
  request?: { subject?: string | null } | null;
  waiting_for?: {
    type?: { id?: number | null } | null;
    value?: number | string | null;
  } | null;
}

interface DetailsByViewResponse {
  data?: DetailsByViewRow[] | null;
  next_page_key?: string | null;
}

export interface SlaViewTicket {
  id: number;
  agentInvgateId: number | null;
  subject: string;
  slaResolution: string | null;
  slaFirstReply: string | null;
}

export interface SlaPendingTicketsResult {
  ok: boolean;
  tickets: SlaViewTicket[];
  error?: string;
}

let slaPendingCache: { data: SlaPendingTicketsResult; timestamp: number } | null = null;

/** Invalida el caché en memoria tras aplicar postergaciones. */
export function invalidateSlaPendingTicketsCache(): void {
  slaPendingCache = null;
}

/**
 * Tickets de la vista de SLA que están esperando a un agente.
 *
 * El % de SLA no viene en la vista: se completa con el batch de `/incidents`
 * (50 ids por llamada), igual que `getUnassignedTicketsByHelpdesk`.
 */
export async function getSlaPendingTickets(): Promise<SlaPendingTicketsResult> {
  const now = Date.now();
  if (slaPendingCache && now - slaPendingCache.timestamp < CACHE_TTL_MS) {
    return slaPendingCache.data;
  }

  try {
    const rows: DetailsByViewRow[] = [];
    let pageKey: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        view_id: String(AGS_SLA_VIEW_ID),
        sort_by: "last_update",
        order_by: "asc",
      });
      if (pageKey) params.set("page_key", pageKey);

      const res = await invgateGet<DetailsByViewResponse>(
        `incidents.details.by.view?${params.toString()}`
      );
      if (!res.ok) return { ok: false, tickets: [], error: res.message };

      rows.push(...(res.data?.data ?? []));
      pageKey = res.data?.next_page_key ?? null;
      if (!pageKey) break;
    }

    // Sólo interesa lo que espera a un agente (waiting_for.type.id === 1).
    const pending = rows.filter((row) => row.waiting_for?.type?.id === 1);
    if (pending.length === 0) {
      const empty: SlaPendingTicketsResult = { ok: true, tickets: [] };
      slaPendingCache = { data: empty, timestamp: Date.now() };
      return empty;
    }

    const slaById = new Map<number, InvgateIncident>();
    const ids = pending.map((row) => row.id);
    for (let i = 0; i < ids.length; i += SLA_BATCH_SIZE) {
      const batch = ids.slice(i, i + SLA_BATCH_SIZE);
      const queryParams = batch.map((id) => `ids[]=${id}`).join("&");
      const batchRes = await invgateGet<Record<string, InvgateIncident>>(
        `incidents?${queryParams}`
      );
      if (batchRes.ok && batchRes.data) {
        for (const inc of Object.values(batchRes.data)) slaById.set(inc.id, inc);
      }
    }

    const tickets: SlaViewTicket[] = pending.map((row) => {
      const inc = slaById.get(row.id);
      const agentInvgateId = Number(row.waiting_for?.value);
      return {
        id: row.id,
        agentInvgateId: Number.isInteger(agentInvgateId) && agentInvgateId > 0 ? agentInvgateId : null,
        subject: row.request?.subject || inc?.title || "",
        slaResolution: inc?.sla_incident_resolution ?? null,
        slaFirstReply: inc?.sla_incident_first_reply ?? null,
      };
    });

    const result: SlaPendingTicketsResult = { ok: true, tickets };
    slaPendingCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (err: any) {
    return {
      ok: false,
      tickets: [],
      error: err.message || "Error desconocido al consultar InvGate",
    };
  }
}

/** Lo que necesita el selector de cada ticket (sin red). */
export interface SlaPlanTicketInput {
  id: number;
  agentInvgateId: number | null;
  subject?: string;
  slaResolution?: string | null;
  slaFirstReply?: string | null;
}

/** Lo que necesita el selector de cada operador (subconjunto de `getDisponibilidadHoy()`). */
export interface SlaPlanOperator {
  agentId: number;
  invgateId?: number;
  nombre: string;
  disponible: boolean;
  motivo?: string;
  wiseCxCategory?: string;
  proximoTurnoDisponible?: string;
  proximoTurnoMotivo?: string;
}

export interface SlaPostponementPlan {
  ticketId: number;
  agentName: string;
  action: "postpone" | "skip";
  reason: string;
  fechaPropuesta: string | null;
  subject: string;
  slaResolution: string | null;
  slaFirstReply: string | null;
}

/** Categorías de Wise CX en las que el agente está en línea y puede atender ya. */
const ONLINE_CATEGORIES = new Set(["disponible", "en_llamada"]);

/**
 * Decide, ticket por ticket, si corresponde postergar hasta el próximo turno
 * del agente asignado. Puro y sin red: la API lo usa para preview y para
 * recalcular en el momento de aplicar.
 */
export function planSlaPostponements(
  tickets: SlaPlanTicketInput[],
  operators: SlaPlanOperator[],
  now: Date,
): SlaPostponementPlan[] {
  const byInvgateId = new Map<number, SlaPlanOperator>();
  for (const op of operators) {
    if (op.invgateId) byInvgateId.set(op.invgateId, op);
  }

  return tickets.map((ticket) => {
    const base = {
      ticketId: ticket.id,
      subject: ticket.subject || "",
      slaResolution: ticket.slaResolution ?? null,
      slaFirstReply: ticket.slaFirstReply ?? null,
    };
    const skip = (agentName: string, reason: string): SlaPostponementPlan => ({
      ...base,
      agentName,
      action: "skip",
      reason,
      fechaPropuesta: null,
    });

    const operator = ticket.agentInvgateId ? byInvgateId.get(ticket.agentInvgateId) : undefined;
    if (!operator) {
      return skip(
        ticket.agentInvgateId ? `InvGate #${ticket.agentInvgateId}` : "Sin agente",
        "sin turno calculable",
      );
    }

    if (operator.wiseCxCategory && ONLINE_CATEGORIES.has(operator.wiseCxCategory)) {
      return skip(operator.nombre, "agente en línea");
    }

    // `proximoTurnoDisponible` ya cubre fin de break y próximo turno hábil.
    const fecha = operator.proximoTurnoDisponible;
    if (!fecha) return skip(operator.nombre, "sin turno calculable");
    // Nunca postergar a una fecha pasada: pausaría el SLA sólo un instante.
    if (new Date(fecha).getTime() <= now.getTime()) {
      return skip(operator.nombre, "turno ya vencido");
    }

    return {
      ...base,
      agentName: operator.nombre,
      action: "postpone",
      reason: operator.proximoTurnoMotivo || "próximo turno",
      fechaPropuesta: fecha,
    };
  });
}
