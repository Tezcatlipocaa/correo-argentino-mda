import type { APIRoute } from "astro";
import { getUnassignedTicketsByHelpdesk } from "@/lib/invgate/agsTickets";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  try {
    const helpdeskParam = url.searchParams.get("helpdesk_id");
    const helpdeskId = helpdeskParam ? parseInt(helpdeskParam, 10) : 3950;

    if (isNaN(helpdeskId)) {
      return jsonResponse({ error: "helpdesk_id inválido" }, 400);
    }

    const result = await getUnassignedTicketsByHelpdesk(helpdeskId);

    if (!result.ok) {
      return jsonResponse({ error: result.error, helpdeskId: result.helpdeskId, tickets: [] }, 500);
    }

    return jsonResponse(
      {
        helpdeskId: result.helpdeskId,
        count: result.tickets.length,
        tickets: result.tickets,
      },
      200,
      "no-store"
    );
  } catch (error: any) {
    console.error("[InvGate Unassigned Tickets API] Error:", error);
    return jsonResponse({ error: sanitizeError(error) }, 500);
  }
};
