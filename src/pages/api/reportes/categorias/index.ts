import type { APIRoute } from "astro";
import { requireReadAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { getCategoryCatalogReport } from "@lib/categories/service";

export const GET: APIRoute = async ({ request, locals }) => {
  const denied = await requireReadAccess(locals, "reportes");
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const rootIdParam = url.searchParams.get("rootId");
    const rootId = rootIdParam ? parseInt(rootIdParam, 10) : 1;

    if (Number.isNaN(rootId)) {
      return jsonError("El parámetro rootId debe ser un número válido", 400);
    }

    const report = await getCategoryCatalogReport(rootId);
    return jsonResponse(report);
  } catch (error) {
    console.error("GET /api/reportes/categorias error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
