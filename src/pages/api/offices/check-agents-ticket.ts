import type { APIRoute } from "astro";
import type { InvgateByStatusResponse, InvgateIncident } from "@/types/invgate";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { invgateGet } from "@lib/invgateClient";
import { invgateQaGet } from "@lib/invgate-qa-client";
import {
  USE_QA_INVGATE,
  AGENTS_TICKET_CATEGORY_ID,
  TELEGRAFIA_HELPDESK_ID,
  getInvgateLocationId,
} from "@lib/telegrafiaTicket";

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "usuarios");
  if (denied) return denied;

  const url = new URL(request.url);
  const officeCode = url.searchParams.get("officeCode");

  if (!officeCode || !officeCode.trim()) {
    return jsonError("El parámetro officeCode es requerido.", 400);
  }

  try {
    const invgateLocationId = getInvgateLocationId(officeCode.trim());

    if (invgateLocationId === null) {
      return jsonResponse({
        exists: false,
        reason: "No se encontró ubicación de InvGate para esta oficina.",
      });
    }

    const getFn = USE_QA_INVGATE ? invgateQaGet : invgateGet;

    // Step 1: Get all open ticket IDs for telegrafia helpdesk
    const helpdeskRes = await getFn<InvgateByStatusResponse>(
      `incidents.by.helpdesk?helpdesk_id=${TELEGRAFIA_HELPDESK_ID}&limit=200`,
    );

    if (!helpdeskRes.ok || !helpdeskRes.data?.requestIds) {
      return jsonResponse({
        exists: false,
        reason: "No se pudieron consultar los tickets del helpdesk.",
      });
    }

    const requestIds = helpdeskRes.data.requestIds;

    if (requestIds.length === 0) {
      return jsonResponse({ exists: false });
    }

    // Step 2: Batch fetch full objects (max 200 IDs, URL-safe)
    const idsQuery = requestIds.map((id) => `ids[]=${id}`).join("&");
    const incidentsRes = await getFn<Record<string, InvgateIncident>>(
      `incidents?${idsQuery}`,
    );

    if (!incidentsRes.ok || !incidentsRes.data) {
      return jsonResponse({
        exists: false,
        reason: "No se pudieron obtener los detalles de los tickets.",
      });
    }

    // Step 3: Filter by category_id and location_id
    const incidents = Object.values(incidentsRes.data);
    const matchingIncident = incidents.find(
      (inc) =>
        inc.category_id === AGENTS_TICKET_CATEGORY_ID &&
        inc.location_id === invgateLocationId,
    );

    if (!matchingIncident) {
      return jsonResponse({ exists: false });
    }

    // Step 4: Build ticket URL
    const invgateBaseUrl = USE_QA_INVGATE
      ? (import.meta.env.INVGATE_QA_BASE_URL || "")
      : (import.meta.env.INVGATE_BASE_URL || "");
    const cleanBaseUrl = invgateBaseUrl.replace(/\/api\/v1\/?$/, "");
    const ticketUrl = `${cleanBaseUrl}/requests/show/index/id/${matchingIncident.id}`;

    return jsonResponse({
      exists: true,
      ticketId: matchingIncident.id,
      ticketTitle: matchingIncident.title,
      ticketUrl,
    });
  } catch (error: any) {
    console.error("GET /api/offices/check-agents-ticket Error:", error);
    return jsonError(
      error?.message || "Error al verificar tickets existentes.",
      500,
    );
  }
};
