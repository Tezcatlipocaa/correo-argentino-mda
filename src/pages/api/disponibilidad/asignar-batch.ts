import type { APIRoute } from "astro";
import {
  asignarSugeridasAutogestion,
  asignarTodasEnCola,
  getDisponibilidadHoy,
  ensureHasLock,
  resetAssignmentLock,
} from "@lib/disponibilidad";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "asignacion_ag");
  if (denied) return denied;

  const lockCheck = await ensureHasLock(locals);
  if (!lockCheck.ok) return lockCheck.response;

  try {
    const { mode } = await request.json();

    if (mode !== "suggested" && mode !== "all") {
      return jsonResponse(
        { success: false, error: "Modo de asignación inválido ('suggested' o 'all')" },
        400
      );
    }

    const assignedBy = locals.user?.username || "Sistema";
    const userClean = locals.user?.username ? locals.user.username.split("@")[0].toLowerCase().trim() : "";
    const list = await getDisponibilidadHoy();
    const loggedOp = list.find((op) => op.username && op.username.split("@")[0].toLowerCase().trim() === userClean);
    const authorInvgateId = loggedOp?.invgateId;

    let result;
    if (mode === "suggested") {
      result = await asignarSugeridasAutogestion(assignedBy, authorInvgateId);
    } else {
      result = await asignarTodasEnCola(assignedBy, authorInvgateId);
    }

    if (result.success) {
      await resetAssignmentLock();
    }

    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error: any) {
    console.error("POST /api/disponibilidad/asignar-batch Error:", error);
    return jsonResponse({ success: false, error: sanitizeError(error) }, 500);
  }
};
