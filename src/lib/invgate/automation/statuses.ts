import { invgateGet } from "@lib/invgateClient";
import {
  readPersistedCache,
  writePersistedCache,
} from "@lib/invgate/cache";
import type { InvgateResult } from "@/types/invgate";

const STATUSES_ENDPOINT = "incident.attributes.status";

/**
 * Shape validado empíricamente contra QA:
 * [{"id":1,"name":"Nuevo"}, ...]
 */
export interface InvgateStatus {
  id: number;
  name: string;
}

export async function getIncidentStatuses(): Promise<
  InvgateResult<InvgateStatus[]>
> {
  if (
    cachedStatuses !== null &&
    cachedStatuses.expiresAt > Date.now()
  ) {
    return { ok: true, status: 200, data: cachedStatuses.data };
  }

  const persisted = readPersistedCache<InvgateStatus[]>(STATUS_CACHE_KEY);
  if (Array.isArray(persisted) && persisted.length > 0) {
    cachedStatuses = {
      data: persisted,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
    };
    return { ok: true, status: 200, data: persisted };
  }

  const result = await invgateGet<InvgateStatus[]>(STATUSES_ENDPOINT);

  if (result.ok) {
    cachedStatuses = {
      data: result.data,
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
    };
    writePersistedCache(STATUS_CACHE_KEY, result.data, STATUS_CACHE_TTL_MS);
  }

  return result;
}

/**
 * Cache por proceso + persistido en SQLite: los nombres de estado casi nunca
 * cambian y este endpoint se consulta en cada render de las islas del módulo.
 */
const STATUS_CACHE_TTL_MS = 24 * 60 * 60_000;
const STATUS_CACHE_KEY = "automation.statuses";

let cachedStatuses: { data: InvgateStatus[]; expiresAt: number } | null = null;
