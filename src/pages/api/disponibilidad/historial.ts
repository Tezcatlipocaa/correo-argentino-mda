import type { APIRoute } from "astro";
import { getAssignmentHistory } from "@lib/disponibilidad";
import { getUnassignedTicketsByHelpdesk } from "@/lib/invgate/agsTickets";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const GET: APIRoute = async () => {
  try {
    const history = await getAssignmentHistory(50);
    const unassignedRes = await getUnassignedTicketsByHelpdesk(3866);
    const unassignedTicketIds = new Set(
      unassignedRes.ok ? unassignedRes.tickets.map((t) => t.id) : []
    );

    const seenTickets = new Set<string>();

    const enrichedHistory = history.map((item) => {
      let canUndo = false;
      if (item.ticketNumber && item.type !== "undo") {
        const ticketKey = item.ticketNumber.trim();
        const numId = Number(ticketKey.replace(/[^0-9]/g, ""));
        
        if (!seenTickets.has(ticketKey)) {
          seenTickets.add(ticketKey);
          if (!isNaN(numId) && numId > 0 && !unassignedTicketIds.has(numId)) {
            canUndo = true;
          }
        }
      }
      return {
        ...item,
        canUndo,
      };
    });

    return jsonResponse({ ok: true, history: enrichedHistory }, 200);
  } catch (error: any) {
    console.error("GET /api/disponibilidad/historial Error:", error);
    return jsonResponse({ ok: false, history: [], error: sanitizeError(error) }, 500);
  }
};
