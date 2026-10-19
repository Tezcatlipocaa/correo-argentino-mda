import type { APIRoute } from "astro";
import { requireReadAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { getWorkflowReport } from "@lib/workflows/service";

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = await requireReadAccess(locals, "reportes");
  if (denied) return denied;

  const slug = params.slug || "implementacion";

  try {
    const report = await getWorkflowReport(slug);
    return jsonResponse(report);
  } catch (error) {
    return jsonError(sanitizeError(error), 404);
  }
};
