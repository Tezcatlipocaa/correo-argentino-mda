import type { APIRoute } from "astro";
import { jsonError, jsonResponse } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { loadUsuariosEstadisticas } from "@lib/usuariosEstadisticas";

export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "usuarios");
  if (denied) return denied;

  const result = await loadUsuariosEstadisticas(
    url.searchParams.get("rol"),
    url.searchParams.get("mesa"),
    url.searchParams.get("activo"),
  );

  if (!result.ok) {
    return jsonError(result.error, 400, "no-store");
  }

  return jsonResponse(result.data, 200, "no-store");
};
