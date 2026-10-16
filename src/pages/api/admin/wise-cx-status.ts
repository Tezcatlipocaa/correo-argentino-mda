import type { APIRoute } from "astro";
import { wiseCxGet } from "@/lib/wise-cx-client";
import { jsonResponse } from "@/lib/apiResponse";

export type WiseCxErrorCategory =
  | "config"
  | "credentials"
  | "permissions"
  | "network"
  | "timeout"
  | "not_found"
  | "other";

function parseWiseCxDiagnostic(result: {
  ok: boolean;
  status?: number;
  message?: string;
}): { category: WiseCxErrorCategory; hint: string; detail: string } {
  const msg = result.message || "";
  const status = result.status || 0;

  if (/no definida|variable de entorno/i.test(msg)) {
    return {
      category: "config",
      hint: "Falta configurar WISE_CX_API_KEY, WISE_CX_BASE_URL o WISE_CX_API_USER en .env",
      detail: msg,
    };
  }

  if (/Autenticacion fallida.*401/i.test(msg) || status === 401) {
    return {
      category: "credentials",
      hint: "Credenciales inválidas en Wise CX: verificar WISE_CX_API_KEY y WISE_CX_API_USER en .env",
      detail: msg || `HTTP 401 Unauthorized`,
    };
  }

  if (/Autenticacion fallida.*403/i.test(msg) || status === 403) {
    return {
      category: "permissions",
      hint: "Acceso denegado o permisos insuficientes en Wise CX: verificar rol de la clave y usuario",
      detail: msg || `HTTP 403 Forbidden`,
    };
  }

  if (status === 404) {
    return {
      category: "not_found",
      hint: "Ruta o canal no encontrado en Wise CX: verificar WISE_CX_BASE_URL",
      detail: msg || `HTTP 404 Not Found`,
    };
  }

  if (/timeout|aborted|ETIMEDOUT/i.test(msg)) {
    return {
      category: "timeout",
      hint: "Tiempo de espera agotado al conectar con Wise CX: verificar latencia de red",
      detail: msg,
    };
  }

  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|Error de red/i.test(msg)) {
    return {
      category: "network",
      hint: "Error de red o DNS al contactar Wise CX: verificar WISE_CX_BASE_URL y acceso a Internet/VPN",
      detail: msg,
    };
  }

  return {
    category: "other",
    hint: msg || `Error HTTP ${status}`,
    detail: msg || `HTTP ${status}`,
  };
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const start = Date.now();
  const result = await wiseCxGet<unknown>("/core/v1/channels?limit=1");
  const latencyMs = Date.now() - start;

  if (result.ok) {
    return jsonResponse({
      ok: true,
      category: null,
      status: result.status,
      latencyMs,
      message: "Conexión exitosa (Wise CX)",
      detail: null,
    });
  }

  const diag = parseWiseCxDiagnostic(result);

  return jsonResponse({
    ok: false,
    category: diag.category,
    status: result.status,
    latencyMs,
    message: diag.hint,
    detail: diag.detail,
  });
};
