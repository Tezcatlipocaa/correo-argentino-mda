import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";
import type { InvgateIncidentTask } from "./types";

const TASKS_ENDPOINT = "incident.tasks";

export async function getIncidentTasks(
  requestId: number,
): Promise<InvgateResult<InvgateIncidentTask[]>> {
  const search = new URLSearchParams({ request_id: String(requestId) });
  return invgateGet<InvgateIncidentTask[]>(
    `${TASKS_ENDPOINT}?${search.toString()}`,
  );
}
