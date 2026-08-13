import type { APIRoute } from "astro";
import { reassignTicketToAgent } from "@lib/invgate/agsTickets";
import { getDisponibilidadHoy } from "@lib/disponibilidad";
import { db } from "@db/index";
import { assignmentHistory } from "@db/schema";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "asignacion_ag");
  if (denied) return denied;

  try {
    const { ticketNumber } = await request.json();

    if (!ticketNumber) {
      return jsonResponse({ success: false, error: "Número de ticket no provisto." }, 400);
    }

    const numericId = Number(String(ticketNumber).replace(/[^0-9]/g, ""));
    if (isNaN(numericId) || numericId <= 0) {
      return jsonResponse({ success: false, error: "ID de ticket inválido." }, 400);
    }

    const userClean = locals.user?.username ? locals.user.username.split("@")[0].toLowerCase().trim() : "";
    const list = await getDisponibilidadHoy();
    const loggedOp = list.find((op) => op.username && op.username.split("@")[0].toLowerCase().trim() === userClean);
    const authorInvgateId = loggedOp?.invgateId || 1;

    // Call InvGate QA to reassign ticket to agent_id: 0 (unassigned)
    const reassignRes = await reassignTicketToAgent(numericId, 0, 3866, authorInvgateId);
    if (!reassignRes.ok) {
      return jsonResponse({ success: false, error: `Error al desasignar ticket #${numericId} en InvGate: ${reassignRes.message}` }, 400);
    }

    // Log history undo event
    try {
      await db.insert(assignmentHistory).values({
        agentId: 0,
        agentName: "Sin Asignar",
        ticketNumber: `#${numericId}`,
        assignedBy: `Deshecho por ${locals.user?.username || "Sistema"}`,
        assignedAt: Date.now(),
        type: "undo",
      });
    } catch (hErr) {
      console.error("Error logging undo ticket history:", hErr);
    }

    return jsonResponse({ success: true, message: `Ticket #${numericId} devuelto a sin asignar.` }, 200);
  } catch (error: any) {
    console.error("POST /api/disponibilidad/deshacer-ticket Error:", error);
    return jsonResponse({ success: false, error: sanitizeError(error) }, 500);
  }
};
