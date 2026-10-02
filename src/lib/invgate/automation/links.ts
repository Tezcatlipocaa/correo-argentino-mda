import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";
import type { InvgateIncidentLink } from "./types";

const LINKS_ENDPOINT = "incident.link";

export async function getIncidentLinks(
  requestId: number,
): Promise<InvgateResult<InvgateIncidentLink[]>> {
  const search = new URLSearchParams({ request_id: String(requestId) });
  return invgateGet<InvgateIncidentLink[]>(
    `${LINKS_ENDPOINT}?${search.toString()}`,
  );
}
