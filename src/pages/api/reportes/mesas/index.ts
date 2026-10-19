import type { APIRoute } from "astro";
import { requireReadAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError, sanitizeError } from "@lib/apiResponse";
import { getHelpdesksReport } from "@lib/helpdesks/service";

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireReadAccess(locals, "reportes");
  if (denied) return denied;

  try {
    const report = await getHelpdesksReport();
    return jsonResponse(report);
  } catch (error) {
    return jsonError(sanitizeError(error), 500);
  }
};
