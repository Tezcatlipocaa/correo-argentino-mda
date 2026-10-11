import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";
import type { InvgateIncidentLink } from "./types";

const LINKS_ENDPOINT = "incident.link";

export async function getIncidentLinks(
  requestId: number,
): Promise<InvgateResult<InvgateIncidentLink[]>> {
  const search = new URLSearchParams({ request_id: String(requestId) });
  const result = await invgateGet<InvgateIncidentLink[]>(
    `${LINKS_ENDPOINT}?${search.toString()}`,
  );
  // InvGate puede devolver un shape inesperado (objeto/null) en vez de []; el
  // resto del pipeline asume un array. Degradamos a lista vacía.
  if (result.ok && !Array.isArray(result.data)) {
    return { ok: true, status: result.status, data: [] };
  }
  return result;
}
