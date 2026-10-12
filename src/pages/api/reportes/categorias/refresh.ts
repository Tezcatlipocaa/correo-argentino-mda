import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { logAdminFromAstro } from "@lib/auditLogger";
import { invalidateCategoryCatalogCache } from "@lib/categories/service";

export const POST: APIRoute = async ({ locals }) => {
  const denied = await requireWriteAccess(locals, "reportes");
  if (denied) return denied;

  try {
    invalidateCategoryCatalogCache();
    await logAdminFromAstro(
      locals,
      "Actualizó manualmente las métricas del árbol de categorías",
    );
    return jsonResponse({
      ok: true,
      message: "Cache de categorías invalidado exitosamente",
    });
  } catch (error) {
    console.error("POST /api/reportes/categorias/refresh error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
