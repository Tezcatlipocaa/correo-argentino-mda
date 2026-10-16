// src/pages/api/admin/invgate-qa-status.ts
import type { APIRoute } from "astro";
import { invgateQaGet } from "@/lib/invgate-qa-client";
import { jsonResponse } from "@/lib/apiResponse";

export type InvgateErrorCategory =
  | "config"
  | "credentials"
  | "permissions"
  | "network"
  | "timeout"
  | "not_found"
  | "other";

function parseInvgateDiagnostic(result: {
  ok: boolean;
  status?: number;
  message?: string;
}): { category: InvgateErrorCategory; hint: string; detail: string } {
  const msg = result.message || "";
  const status = result.status || 0;

  if (/no definida|variable de entorno/i.test(msg)) {
    return {
      category: "config",
      hint: "Falta configurar INVGATE_QA_API_KEY o INVGATE_QA_BASE_URL en variables de entorno (.env)",
      detail: msg,
    };
  }

  if (status === 401) {
    return {
      category: "credentials",
      hint: "Credenciales inválidas en InvGate QA: verificar INVGATE_QA_API_KEY y usuario en .env",
      detail: msg || `HTTP 401 Unauthorized`,
    };
  }

  if (status === 403) {
    return {
      category: "permissions",
      hint: "Acceso denegado en InvGate QA: la API key no tiene permisos suficientes para este endpoint",
      detail: msg || `HTTP 403 Forbidden`,
    };
  }

  if (status === 404) {
    return {
      category: "not_found",
      hint: "Endpoint o recurso no encontrado en InvGate QA: verificar que INVGATE_QA_BASE_URL sea correcta",
      detail: msg || `HTTP 404 Not Found`,
    };
  }

  if (/timeout|aborted|ETIMEDOUT/i.test(msg)) {
    return {
      category: "timeout",
      hint: "Tiempo de espera agotado al conectar con InvGate QA: verificar latencia de red",
      detail: msg,
    };
  }

  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|Error de red/i.test(msg)) {
    return {
      category: "network",
      hint: "Error de conexión o DNS con InvGate QA: verificar INVGATE_QA_BASE_URL y acceso de red/VPN",
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
  const result = await invgateQaGet<{ version: string }>("sd.version");
  const latencyMs = Date.now() - start;

  if (result.ok) {
    return jsonResponse({
      ok: true,
      category: null,
      status: result.status,
      latencyMs,
      message: "Conexión exitosa (QA)",
      detail: null,
    });
  }

  const diag = parseInvgateDiagnostic(result);

  return jsonResponse({
    ok: false,
    category: diag.category,
    status: result.status,
    latencyMs,
    message: diag.hint,
    detail: diag.detail,
  });
};
