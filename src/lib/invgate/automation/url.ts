import { getServerEnv } from "./env";

/**
 * Deriva la URL de la UI de InvGate (no-API) a partir del base URL configurado:
 * INVGATE_BASE_URL "https://xxx.sd.cloud.invgate.net/api/v1/"
 *   -> "https://xxx.sd.cloud.invgate.net/requests/show/index/id/{id}"
 * Formato validado por el usuario (2026-08). Nada hardcodeado.
 */
export function deriveInvGateUiUrl(requestId: number): string {
  const origin = getServerEnv("INVGATE_BASE_URL")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/+$/, "");
  if (!origin.startsWith("http")) {
    return "";
  }
  return `${origin}/requests/show/index/id/${requestId}`;
}
