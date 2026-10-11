import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { getOpenAgentsTicketsByLocation } from "@lib/agentsTicketDuplicates";
import { resolveInvgateLocationId } from "@lib/invgate/resolveOfficeLocation";
import { USE_QA_INVGATE } from "@lib/telegrafiaTicket";

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = await requireWriteAccess(locals, "usuarios");
  if (denied) return denied;

  const url = new URL(request.url);
  const officeCode = url.searchParams.get("officeCode");

  if (!officeCode || !officeCode.trim()) {
    return jsonError("El parámetro officeCode es requerido.", 400);
  }

  try {
    const invgateLocationId = await resolveInvgateLocationId(officeCode.trim());

    if (invgateLocationId === null) {
      return jsonResponse({
        exists: false,
        reason: "No se encontró ubicación de InvGate para esta oficina.",
      });
    }

    const byLocation = await getOpenAgentsTicketsByLocation();
    const matchingIncident = byLocation.get(invgateLocationId)?.[0];

    if (!matchingIncident) {
      return jsonResponse({ exists: false });
    }

    const invgateBaseUrl = USE_QA_INVGATE
      ? import.meta.env.INVGATE_QA_BASE_URL ||
        process.env.INVGATE_QA_BASE_URL ||
        ""
      : import.meta.env.INVGATE_BASE_URL || process.env.INVGATE_BASE_URL || "";
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
      502,
    );
  }
};
