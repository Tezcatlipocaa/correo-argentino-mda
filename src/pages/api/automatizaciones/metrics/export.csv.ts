import type { APIRoute } from "astro";
import { jsonError, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { getAutomationMetrics } from "@lib/workflow/metrics";
import {
  buildMetricsCsv,
  parseWindowParam,
} from "@lib/workflow/metricsExport";

/**
 * Export CSV del reporte de métricas de automatizaciones. Respeta el query
 * param `window` (30/90/365/all).
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "automatizaciones");
  if (denied) return denied;

  try {
    const metrics = getAutomationMetrics({
      windowDays: parseWindowParam(url.searchParams.get("window")),
    });
    const csv = buildMetricsCsv(metrics);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="automatizaciones_metricas_${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[API automatizaciones/metrics/export.csv] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
