import type { APIRoute } from "astro";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { resolveAutomationProgress } from "@lib/workflow/resolver";

/**
 * Progreso de una automatización para las cards del listado (fetch lazy al
 * expandir). Usa el pipeline liviano (link + bulk): sirve el snapshot
 * persistido si existe y, si no, evita tasks/solutions/wf.request.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const denied = requireReadAccess(locals, "automatizaciones");
  if (denied) {
    return denied;
  }

  const automationId = Number.parseInt(params.id ?? "", 10);
  if (!Number.isInteger(automationId)) {
    return jsonError("El id de la automatización debe ser un entero", 400);
  }

  try {
    const result = await resolveAutomationProgress(automationId);

    if (!result.ok) {
      return jsonError(result.message, 502, "no-store");
    }

    return jsonResponse({ progress: result.progress }, 200, "no-store");
  } catch (error) {
    console.error("[API automatizaciones/progress] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
