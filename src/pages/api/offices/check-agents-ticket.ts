import type { APIRoute } from "astro";
import type { InvgateByStatusResponse, InvgateIncident } from "@/types/invgate";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { invgateGet } from "@lib/invgateClient";
import { invgateQaGet } from "@lib/invgate-qa-client";
import {
  USE_QA_INVGATE,
  AGENTS_TICKET_CATEGORY_ID,
} from "@lib/telegrafiaTicket";
import { resolveInvgateLocationId } from "@lib/invgate/resolveOfficeLocation";

// Status de ticket abiertos (excluye Cerrado, Rechazado, Cancelado)
const OPEN_STATUS_IDS = [1, 2, 3, 4, 5];

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "usuarios");
  if (denied) return denied;

  const url = new URL(request.url);
  const officeCode = url.searchParams.get("officeCode");

  if (!officeCode || !officeCode.trim()) {
    return jsonError("El parámetro officeCode es requerido.", 400);
  }

  try {
    const invgateLocationId = await resolveInvgateLocationId(
      officeCode.trim(),
    );

    if (invgateLocationId === null) {
      return jsonResponse({
        exists: false,
        reason: "No se encontró ubicación de InvGate para esta oficina.",
      });
    }

    const getFn = USE_QA_INVGATE ? invgateQaGet : invgateGet;

    // Step 1: Get all open ticket IDs (status 1-5), paginating
    const statusQuery = OPEN_STATUS_IDS.map((s) => `status_ids[]=${s}`).join(
      "&",
    );
    const requestIds: number[] = [];
    let offset = 0;
    let total = 1;
    let pages = 0;
    const MAX_PAGES = 10;

    while (offset < total && pages < MAX_PAGES) {
      const pageRes = await getFn<InvgateByStatusResponse>(
        `incidents.by.status?${statusQuery}&limit=200&offset=${offset}`,
      );

      if (!pageRes.ok || !pageRes.data?.requestIds) {
        return jsonResponse({
          exists: false,
          reason: "No se pudieron consultar los tickets abiertos.",
        });
      }

      requestIds.push(...pageRes.data.requestIds);
      total = pageRes.data.total ?? requestIds.length;
      offset += pageRes.data.requestIds.length;
      pages++;
    }

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
