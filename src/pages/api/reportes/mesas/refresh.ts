import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { logAdminFromAstro } from "@lib/auditLogger";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { invalidateHelpdesksCache } from "@lib/helpdesks/service";

export const POST: APIRoute = async ({ locals }) => {
  const denied = await requireWriteAccess(locals, "reportes");
  if (denied) return denied;

  try {
    invalidateHelpdesksCache();
    await logAdminFromAstro(
      locals,
      "Actualizó manualmente las métricas de mesas de ayuda",
    );
    return jsonResponse({
      ok: true,
      message: "Cache de mesas de ayuda invalidado exitosamente",
    });
  } catch (error) {
    return jsonError(sanitizeError(error), 500);
  }
};
