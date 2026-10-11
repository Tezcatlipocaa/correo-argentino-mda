import { invgateGet } from "@lib/invgateClient";
import { mapWithConcurrency } from "@lib/async";
import {
  readPersistedCache,
  writePersistedCache,
} from "@lib/invgate/cache";
import { childCacheTtlMs } from "./cache-config";
import type { InvgateResult } from "@/types/invgate";
import type { InvgateComment, InvgateIncidentsByIdResponse } from "./types";

const INCIDENTS_ENDPOINT = "incidents";
/**
 * Tamaño de lote verificado en producción (2026-09): 200 ids por llamada
 * responde 200 OK con los 200 objetos (URL ~3,1KB). El valor QA de 50 se
 * agrandó para reducir llamadas en scans bulk.
 */
export const BULK_CHUNK_SIZE = 200;

/** Lotes que se resuelven en paralelo; acota la concurrencia contra la API. */
const BULK_CONCURRENCY = 4;

export interface GetIncidentsOptions {
  /**
   * Solicita comentarios inline de cada incidente (param documentado y
   * validado contra QA: &comments=1 incluye el array `comments` en cada item).
   */
  includeComments?: boolean;
}

function buildIdsQuery(
  ids: readonly number[],
  options?: GetIncidentsOptions,
): string {
  const search = new URLSearchParams();
  ids.forEach((id) => search.append("ids[]", String(id)));
  if (options?.includeComments) {
    search.append("comments", "1");
  }
  return search.toString();
}

async function getIncidentsChunk(
  incidentIds: readonly number[],
  options?: GetIncidentsOptions,
): Promise<InvgateResult<InvgateIncidentsByIdResponse>> {
  return invgateGet<InvgateIncidentsByIdResponse>(
    `${INCIDENTS_ENDPOINT}?${buildIdsQuery(incidentIds, options)}`,
  );
}

/**
 * GET /incidents es un lector bulk exclusivamente por IDs.
 * El envelope validado con el ticket real 317 es un objeto indexado por ID:
 * {"317": {...}}. Los lotes se resuelven en batches concurrentes acotados.
 */
export async function getIncidents(
  incidentIds: readonly number[],
  options?: GetIncidentsOptions,
): Promise<InvgateResult<InvgateIncidentsByIdResponse>> {
  if (incidentIds.length === 0) {
    return { ok: true, status: 200, data: {} };
  }

  const chunks: number[][] = [];
  for (let index = 0; index < incidentIds.length; index += BULK_CHUNK_SIZE) {
    chunks.push(incidentIds.slice(index, index + BULK_CHUNK_SIZE));
  }

  const merged: InvgateIncidentsByIdResponse = {};
  let lastStatus = 200;

  for (let index = 0; index < chunks.length; index += BULK_CONCURRENCY) {
    const batch = chunks.slice(index, index + BULK_CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk) => getIncidentsChunk(chunk, options)),
    );

    for (const result of results) {
      if (!result.ok) {
        return result;
      }

      lastStatus = result.status;
      for (const [id, incident] of Object.entries(result.data)) {
        merged[id] = incident;
      }
    }
  }

  return { ok: true, status: lastStatus, data: merged };
}

/**
 * GET /incident.comment?request_id= devuelve el array completo de comentarios
 * con el flag is_solution (el bulk /incidents?comments=1 lo omite en
 * producción). Para cada request resolvemos el comentario marcado como
 * solución con su autor; si no hay, null.
 */
export interface SolutionComment {
  message: string;
  authorId: number | null;
}

/** Límite de llamadas concurrentes a /incident.comment (una por request). */
const SOLUTION_CONCURRENCY = 8;

/** Cache persistido por request: la solución no cambia dentro del TTL. */
function solutionCacheKey(requestId: number): string {
  return `automation.solution.${requestId}`;
}

export async function getSolutionComments(
  requestIds: readonly number[],
): Promise<Map<number, SolutionComment>> {
  const solutions = new Map<number, SolutionComment>();
  if (requestIds.length === 0) {
    return solutions;
  }

  const results = await mapWithConcurrency(
    requestIds,
    SOLUTION_CONCURRENCY,
    async (requestId) => {
      const cached = readPersistedCache<{ solution: SolutionComment | null }>(
        solutionCacheKey(requestId),
      );
      if (cached) {
        return [requestId, cached.solution] as const;
      }

      let solution: SolutionComment | null = null;
      try {
        const result = await invgateGet<InvgateComment[]>(
          `incident.comment?request_id=${requestId}`,
        );
        if (result.ok && Array.isArray(result.data)) {
          const found = result.data.find((comment) => comment.is_solution);
          solution = found
            ? {
                message: found.message,
                authorId:
                  typeof found.author_id === "number"
                    ? found.author_id
                    : null,
              }
            : null;
        }
      } catch {
        return [requestId, null] as const;
      }

      writePersistedCache(
        solutionCacheKey(requestId),
        { solution },
        childCacheTtlMs(),
      );
      return [requestId, solution] as const;
    },
  );

  for (const [requestId, solution] of results) {
    if (solution) {
      solutions.set(requestId, solution);
    }
  }
  return solutions;
}
