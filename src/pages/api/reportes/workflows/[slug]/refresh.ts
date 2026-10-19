import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { logAdminFromAstro } from "@lib/auditLogger";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { invalidateWorkflowCache } from "@lib/workflows/service";

export const POST: APIRoute = async ({ params, locals }) => {
  const denied = await requireWriteAccess(locals, "reportes");
  if (denied) return denied;

  const slug = params.slug || "implementacion";

  try {
    invalidateWorkflowCache(slug);
    await logAdminFromAstro(
      locals,
      `Actualizó manualmente las métricas del workflow ${slug}`,
    );
    return jsonResponse({
      ok: true,
      message: `Cache del workflow ${slug} invalidado exitosamente`,
    });
  } catch (error) {
    return jsonError(sanitizeError(error), 500);
  }
};
