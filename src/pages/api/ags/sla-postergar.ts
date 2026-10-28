import type { APIRoute } from "astro";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess, requireWriteAccess } from "@lib/rbac-middleware";
import { logAdminFromAstro } from "@lib/auditLogger";
import { validateRequestCsrf } from "@lib/csrf";
import { getDisponibilidadHoy } from "@lib/disponibilidad";
import {
  getSlaPendingTickets,
  invalidateSlaPendingTicketsCache,
  planSlaPostponements,
  type SlaPostponementPlan,
} from "@lib/invgate/agsSlaView";
import { setTicketWaitingForDate } from "@lib/invgate/agsTickets";
import { readPersistedCache, writePersistedCache } from "@lib/invgate/cache";

/**
 * Postergación manual de autogestiones con SLA por vencer: las que esperan a un
 * agente y tienen al menos un SLA corriendo (vista guardada de InvGate).
 *
 * GET  → preview del plan (nunca escribe).
 * POST → aplica sobre los tickets que sigan siendo postergables, recalculando
 *        el plan en el momento. No reasigna: sólo pasa a "Esperando fecha"
 *        para pausar el SLA.
 */

/** Fechas ya aplicadas (ticketId → fecha) para que repetir el POST sea inocuo. */
const POSTPONED_CACHE_KEY = "ags_sla_postponed_dates";
const POSTPONED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function buildPlan(): Promise<{
  ok: boolean;
  plan: SlaPostponementPlan[];
  error?: string;
}> {
  const [ticketsRes, operators] = await Promise.all([
    getSlaPendingTickets(),
    getDisponibilidadHoy(),
  ]);
  if (!ticketsRes.ok) return { ok: false, plan: [], error: ticketsRes.error };
  return {
    ok: true,
    plan: planSlaPostponements(ticketsRes.tickets, operators, new Date()),
  };
}

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireReadAccess(locals, "asignacion_ag");
  if (denied) return denied;

  try {
    const { ok, plan, error } = await buildPlan();
    if (!ok) return jsonError(error || "No se pudo consultar InvGate", 502, "no-store");
    return jsonResponse({ tickets: plan }, 200, "no-store");
  } catch (err) {
    console.error("GET /api/ags/sla-postergar error:", err);
    return jsonError(sanitizeError(err), 500, "no-store");
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requireWriteAccess(locals, "asignacion_ag");
  if (denied) return denied;

  // Muta tickets en InvGate: exige token CSRF de la sesión.
  if (!(await validateRequestCsrf(request, locals))) {
    return jsonError("Token CSRF inválido o ausente", 403);
  }

  // Body ausente = todos los postergables del preview.
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rawIds = body?.ticketIds;
  let selected: Set<number> | null = null;
  if (rawIds !== undefined) {
    if (
      !Array.isArray(rawIds) ||
      rawIds.some((id: unknown) => !Number.isInteger(id) || (id as number) <= 0)
    ) {
      return jsonError("'ticketIds' debe ser un array de IDs de ticket positivos", 400);
    }
    selected = new Set(rawIds as number[]);
  }

  try {
    const operators = await getDisponibilidadHoy();
    const ticketsRes = await getSlaPendingTickets();
    if (!ticketsRes.ok) {
      return jsonError(ticketsRes.error || "No se pudo consultar InvGate", 502);
    }
    const plan = planSlaPostponements(ticketsRes.tickets, operators, new Date());

    // Autoría en InvGate: el operador logueado si se resuelve, si no el 1 de siempre.
    const userClean = locals.user?.username
      ? locals.user.username.split("@")[0].toLowerCase().trim()
      : "";
    const loggedOp = operators.find(
      (op) => op.username && op.username.split("@")[0].toLowerCase().trim() === userClean,
    );
    const authorId = loggedOp?.invgateId ?? 1;

    const stored = readPersistedCache<Record<string, string>>(POSTPONED_CACHE_KEY) ?? {};
    const applied: Array<{ ticketId: number; fecha: string }> = [];
    const skipped: Array<{ ticketId: number; reason: string }> = [];
    const errors: Array<{ ticketId: number; message: string }> = [];

    for (const entry of plan) {
      if (selected && !selected.has(entry.ticketId)) continue;

      if (entry.action !== "postpone" || !entry.fechaPropuesta) {
        skipped.push({ ticketId: entry.ticketId, reason: entry.reason });
        continue;
      }
      if (stored[String(entry.ticketId)] === entry.fechaPropuesta) {
        skipped.push({ ticketId: entry.ticketId, reason: "ya postergado a esa fecha" });
        continue;
      }

      const res = await setTicketWaitingForDate(
        entry.ticketId,
        entry.fechaPropuesta,
        authorId,
      );
      if (res.ok) {
        applied.push({ ticketId: entry.ticketId, fecha: entry.fechaPropuesta });
        stored[String(entry.ticketId)] = entry.fechaPropuesta;
      } else {
        errors.push({
          ticketId: entry.ticketId,
          message: res.message || "Error al posponer en InvGate",
        });
      }
    }

    if (applied.length > 0) {
      writePersistedCache(POSTPONED_CACHE_KEY, stored, POSTPONED_CACHE_TTL_MS);
      invalidateSlaPendingTicketsCache();
      await logAdminFromAstro(
        locals,
        `Postergó ${applied.length} autogestión(es) con SLA por vencer: ${applied
          .map((a) => `#${a.ticketId}`)
          .join(", ")}`,
      );
    }

    return jsonResponse(
      { applied, skipped, errors },
      errors.length > 0 && applied.length === 0 ? 502 : 200,
    );
  } catch (err) {
    console.error("POST /api/ags/sla-postergar error:", err);
    return jsonError(sanitizeError(err), 500);
  }
};
