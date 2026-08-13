import type { APIRoute } from "astro";
import { getAssignmentHistory } from "@lib/disponibilidad";
import { jsonResponse, sanitizeError } from "@lib/apiResponse";

export const GET: APIRoute = async () => {
  try {
    const history = await getAssignmentHistory(50);
    return jsonResponse({ ok: true, history }, 200);
  } catch (error: any) {
    console.error("GET /api/disponibilidad/historial Error:", error);
    return jsonResponse({ ok: false, history: [], error: sanitizeError(error) }, 500);
  }
};
