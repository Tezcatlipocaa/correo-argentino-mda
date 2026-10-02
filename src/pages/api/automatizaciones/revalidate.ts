import type { APIRoute } from "astro";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { revalidateAutomations } from "@lib/workflow/discovery";

/**
 * Fuerza un scan de discovery ignorando caches. La vista de automatizaciones lo
 * llama cuando sirvió un snapshot vencido: espera el scan y luego recarga para
 * reflejar los cambios de estado hechos directamente en InvGate.
 */
export const GET: APIRoute = async ({ locals }) => {
  const denied = requireReadAccess(locals, "automatizaciones");
  if (denied) {
    return denied;
  }

  try {
    const result = await revalidateAutomations();
    if (!result.ok) {
      return jsonError(result.message, 502, "no-store");
    }
    return jsonResponse({ refreshed: true }, 200, "no-store");
  } catch (error) {
    console.error("[API automatizaciones/revalidate] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
