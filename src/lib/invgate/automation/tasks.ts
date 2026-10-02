import { invgateGet } from "@lib/invgateClient";
import {
  readPersistedCache,
  writePersistedCache,
} from "@lib/invgate/cache";
import { childCacheTtlMs } from "./cache-config";
import type { InvgateResult } from "@/types/invgate";
import type { InvgateIncidentTask } from "./types";

const TASKS_ENDPOINT = "incident.tasks";

/** Cache persistido por hijo: las tareas cambian poco dentro del TTL. */
function cacheKey(requestId: number): string {
  return `automation.tasks.${requestId}`;
}

export async function getIncidentTasks(
  requestId: number,
): Promise<InvgateResult<InvgateIncidentTask[]>> {
  const cached = readPersistedCache<{ items: InvgateIncidentTask[] }>(
    cacheKey(requestId),
  );
  if (cached && Array.isArray(cached.items)) {
    return { ok: true, status: 200, data: cached.items };
  }

  const search = new URLSearchParams({ request_id: String(requestId) });
  const result = await invgateGet<InvgateIncidentTask[]>(
    `${TASKS_ENDPOINT}?${search.toString()}`,
  );

  if (result.ok && Array.isArray(result.data)) {
    writePersistedCache(cacheKey(requestId), { items: result.data }, childCacheTtlMs());
  }

  return result;
}
