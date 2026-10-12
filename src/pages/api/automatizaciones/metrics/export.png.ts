import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import { jsonError, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { getAutomationMetrics } from "@lib/workflow/metrics";
import {
  buildMetricsSvg,
  parseWindowParam,
} from "@lib/workflow/metricsExport";

/**
 * Export PNG del reporte de métricas de automatizaciones (SVG server-side +
 * resvg). Respeta el query param `window` (30/90/365/all).
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "automatizaciones");
  if (denied) return denied;

  try {
    const metrics = getAutomationMetrics({
      windowDays: parseWindowParam(url.searchParams.get("window")),
    });
    const built = buildMetricsSvg(metrics, { generatedAt: new Date() });

    const resvg = new Resvg(built.svg, {
      fitTo: { mode: "width", value: built.width * 2 },
      background: "#ffffff",
      font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
    });
    const png = resvg.render().asPng();
    const date = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="automatizaciones_metricas_${date}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[API automatizaciones/metrics/export.png] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
