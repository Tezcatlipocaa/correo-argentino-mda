import type { InvgateByStatusResponse, InvgateIncident } from "@/types/invgate";
import { invgateGet } from "@lib/invgateClient";
import { invgateQaGet } from "@lib/invgate-qa-client";
import {
  USE_QA_INVGATE,
  AGENTS_TICKET_CATEGORY_IDS,
  AGENTS_TICKET_SEARCH_HELPDESK_IDS,
  isAgentsTicketTitle,
} from "@lib/telegrafiaTicket";

/**
 * Candidatos a "ticket de desconexión de agentes" por.location de InvGate.
 *
 * Por qué NO se usa `incidents.by.status`: ese endpoint ignora `location_id`
 * y `status_ids[]` en la práctica, así que obliga a traer los ~3800 tickets
 * abiertos de toda la organización (≈5 MB de JSON) para descartar el 99.3%.
 * Medido en PROD: 6.2s de paginación + 25.6s de detalle = ~32s, con requests
 * de 500 ids que chocan contra el abort de 15s de `invgateClient`.
 *
 * `incidents.by.helpdesk` sí acota por nodo (0.25-0.9s por llamada) y devuelve
 * el set completo del nodo en una sola llamada. Limitaciones reales medidas:
 *  - ignora `limit`, `page_key`, `location_id` y `status_ids[]`;
 *  - solo cubre estados 1-4 (Cerrado / status 5 no existe server-side);
 *  - bajo concurrencia devuelve sets incompletos: siempre secuencial.
 */

const NODE_TIMEOUT_MS = 10000;
const DETAIL_TIMEOUT_MS = 20000;
const DETAIL_CHUNK = 200;
const DETAIL_CONCURRENCY = 3;
const CACHE_TTL_MS = 60_000;

interface CandidateCache {
  expiresAt: number;
  byLocation: Map<number, InvgateIncident[]>;
}

let candidateCache: CandidateCache | null = null;
let inflightFetch: Promise<InvgateIncident[]> | null = null;

function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function fetchOpenHelpdeskIds(): Promise<number[]> {
  const getFn = USE_QA_INVGATE ? invgateQaGet : invgateGet;
  const ids = new Set<number>();

  for (const helpdeskId of AGENTS_TICKET_SEARCH_HELPDESK_IDS) {
    const res = await getFn<InvgateByStatusResponse>(
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
  const getFn = USE_QA_INVGATE ? invgateQaGet : invgateGet;
  const chunks = chunkBy(ids, DETAIL_CHUNK);
  const incidents: InvgateIncident[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      const idsQuery = chunk.map((id) => `ids[]=${id}`).join("&");
      const res = await getFn<Record<string, InvgateIncident>>(
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

  await Promise.all(
    Array.from({ length: DETAIL_CONCURRENCY }, () => worker()),
  );

  return incidents;
}

async function loadCandidates(): Promise<InvgateIncident[]> {
  const ids = await fetchOpenHelpdeskIds();
  if (ids.length === 0) return [];
  return fetchIncidentsByIds(ids);
}

function isAgentsTicket(incident: InvgateIncident): boolean {
  return (
    AGENTS_TICKET_CATEGORY_IDS.includes(incident.category_id ?? -1) ||
    isAgentsTicketTitle(incident.title)
  );
}

/**
 * Cache en memoria del set de tickets abiertos, indexado por location de
 * InvGate. El set no depende de la oficina consultada, así que la segunda
 * apertura del modal dentro del TTL responde sin tocar InvGate.
 */
export async function getOpenAgentsTicketsByLocation(): Promise<
  Map<number, InvgateIncident[]>
> {
  if (candidateCache && candidateCache.expiresAt > Date.now()) {
    return candidateCache.byLocation;
  }

  if (!inflightFetch) {
    inflightFetch = loadCandidates().finally(() => {
      inflightFetch = null;
    });
  }

  const incidents = await inflightFetch;

  const byLocation = new Map<number, InvgateIncident[]>();
  for (const incident of incidents) {
    const locationId = incident.location_id;
    if (locationId == null) continue;
    const list = byLocation.get(locationId) ?? [];
    list.push(incident);
    byLocation.set(locationId, list);
  }

  for (const [locationId, list] of byLocation) {
    byLocation.set(
      locationId,
      list
        .filter(isAgentsTicket)
        .sort((a, b) => a.id - b.id),
    );
  }

  candidateCache = { expiresAt: Date.now() + CACHE_TTL_MS, byLocation };
  return byLocation;
}
