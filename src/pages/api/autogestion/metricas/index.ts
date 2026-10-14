import type { APIRoute } from "astro";
import { requireReadAccess } from "@lib/rbac-middleware";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { getAutogestionesMetricasData } from "@/lib/autogestion/metricasService";

export const GET: APIRoute = async ({ request, locals }) => {
  const authError = await requireReadAccess(locals, "asignacion_ag");
  if (authError) return authError;

  const url = new URL(request.url);
  const preset = url.searchParams.get("preset") || undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  try {
    const data = await getAutogestionesMetricasData(preset, from, to);
    return jsonResponse(data);
  } catch (err: any) {
    console.error("Error fetching autogestiones metrics:", err);
    return jsonError("Error al calcular las métricas de autogestiones", 500);
  }
};
