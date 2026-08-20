import type { APIRoute } from "astro";
import { getTicketComments } from "@/lib/invgate/agsTickets";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  try {
    const requestParam = url.searchParams.get("request_id") || url.searchParams.get("ticket_id");
    const requestId = requestParam ? parseInt(requestParam, 10) : 0;

    if (!requestId || isNaN(requestId)) {
      return jsonResponse({ error: "request_id inválido o faltante" }, 400);
    }

    const result = await getTicketComments(requestId);

    if (!result.ok) {
      return jsonResponse({ error: result.message || "Error al obtener comentarios", comments: [] }, 500);
    }

    return jsonResponse(
      {
        requestId,
        count: result.comments.length,
        comments: result.comments,
      },
      200,
      "no-store"
    );
  } catch (error: any) {
    console.error("[InvGate Ticket Comments API] Error:", error);
    return jsonResponse({ error: sanitizeError(error) }, 500);
  }
};
