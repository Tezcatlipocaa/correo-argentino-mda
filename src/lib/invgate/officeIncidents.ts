import type { InvgateByStatusResponse, InvgateIncident } from "@/types/invgate";
import { invgateGet } from "@lib/invgateClient";

/**
 * Snapshot de los incidentes abiertos de oficina, agrupados por location de
 * InvGate.
 *
 * Mismo patrón que `agentsTicketDuplicates` (y por las mismas razones medidas
 * en PROD): `incidents.by.helpdesk` acota por nodo y es la única vía rápida;
 * `incidents.by.status` baja los ~3800 tickets abiertos de la organización
 * (~32s) e ignora location_id. Cada nodo devuelve su set completo en una
 * llamada (0.25-0.9s), sólo estados 1-4, y bajo concurrencia devuelve sets
 * incompletos: siempre secuencial.
 *
 * Nodos medidos con los spikes `scripts/spike-office-incidents*.mts`:
 * 9 nodos = 100% de los incidentes abiertos con location (47/48; el restante
 * no tiene oficina). Barrido completo de los 143 nodos activos: 33.9s y 0
 * incidentes de oficina adicionales.
 *
 * ponytail: lista point-in-time. Un nodo hoy en 0 puede traer incidentes de
 * oficina mañana; fase 2 (sync en background) barre todos los nodos y expande
 * esta lista con datos medidos.
 */
const OFFICE_INCIDENT_HELPDESK_IDS: number[] = [
  2562, 2507, 6409, 6023, 2558, 5982, 2552, 2498, 5973,
];

const NODE_TIMEOUT_MS = 10000;
const DETAIL_TIMEOUT_MS = 20000;
const DETAIL_CHUNK = 200;
const DETAIL_CONCURRENCY = 3;
const CACHE_TTL_MS = 60_000;

interface SnapshotCache {
  expiresAt: number;
  byLocation: Map<number, InvgateIncident[]>;
}

let snapshotCache: SnapshotCache | null = null;
let inflightFetch: Promise<Map<number, InvgateIncident[]>> | null = null;

function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchOpenHelpdeskIds(): Promise<number[]> {
  const ids = new Set<number>();
  for (const helpdeskId of OFFICE_INCIDENT_HELPDESK_IDS) {
    const res = await invgateGet<InvgateByStatusResponse>(
      `incidents.by.helpdesk?helpdesk_id=${helpdeskId}&limit=500`,
      NODE_TIMEOUT_MS,
    );
    if (!res.ok || !Array.isArray(res.data?.requestIds)) {
      throw new Error(
        "message" in res && res.message
          ? res.message
          : `Respuesta inválida de InvGate al consultar el nodo ${helpdeskId}.`,
      );
    }
    for (const id of res.data.requestIds) ids.add(id);
  }
  return [...ids];
}

async function fetchIncidentsByIds(ids: number[]): Promise<InvgateIncident[]> {
  const chunks = chunkBy(ids, DETAIL_CHUNK);
  const incidents: InvgateIncident[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      const idsQuery = chunk.map((id) => `ids[]=${id}`).join("&");
      const res = await invgateGet<Record<string, InvgateIncident>>(
        `incidents?${idsQuery}`,
        DETAIL_TIMEOUT_MS,
      );
      if (!res.ok || !res.data) {
        throw new Error(
          "message" in res && res.message
            ? res.message
            : "No se pudieron obtener los detalles de los tickets.",
        );
      }
      incidents.push(...Object.values(res.data));
    }
  }

  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, () => worker()));
  return incidents;
}

async function loadSnapshot(): Promise<Map<number, InvgateIncident[]>> {
  const ids = await fetchOpenHelpdeskIds();
  const incidents = ids.length > 0 ? await fetchIncidentsByIds(ids) : [];
  const byLocation = new Map<number, InvgateIncident[]>();
  for (const incident of incidents) {
    if (incident.location_id == null) continue;
    const list = byLocation.get(incident.location_id) ?? [];
    list.push(incident);
    byLocation.set(incident.location_id, list);
  }
  for (const [locationId, list] of byLocation) {
    byLocation.set(
      locationId,
      list.sort((a, b) => a.id - b.id),
    );
  }
  return byLocation;
}

/**
 * Snapshot cacheado 60s. Lanza si InvGate falla; el llamador decide la
 * degradación (el panel muestra "sin datos en vivo" y sigue con lo local).
 */
export async function getOpenOfficeIncidentsByLocation(): Promise<
  Map<number, InvgateIncident[]>
> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.byLocation;
  }
  if (!inflightFetch) {
    inflightFetch = loadSnapshot().finally(() => {
      inflightFetch = null;
    });
  }
  const byLocation = await inflightFetch;
  snapshotCache = { expiresAt: Date.now() + CACHE_TTL_MS, byLocation };
  return byLocation;
}
