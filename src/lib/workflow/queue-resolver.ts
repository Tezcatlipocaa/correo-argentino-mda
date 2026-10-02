import { getIncidentIdsByHelpdesk } from "@lib/invgate/automation/by-helpdesk";
import { getHelpdesks } from "@lib/invgate/automation/helpdesks";
import { getHelpdesksAndLevels } from "@lib/invgate/automation/helpdesks";
import type {
  InvgateHelpdeskNode,
  InvgateHelpdeskLevelNode,
} from "@lib/invgate/automation/helpdesks";
import { getIncidents } from "@lib/invgate/automation/incidents";
import { getServerEnv } from "@lib/invgate/automation/env";
import {
  readPersistedCache,
  writePersistedCache,
  deletePersistedCache,
} from "@lib/invgate/cache";
import { normalizeForCompare } from "./labels";

/**
 * Resuelve la cola (nivel de helpdesk) donde viven los tickets de
 * automatización de sucursales, validado contra producción (2026-09):
 *
 *   helpdesks "TI_GSM_Mesa de Coord" (id 2508)
 *     └── helpdesksandlevels nivel type_id=1, parent_id=2508 (id 6002)
 *           └── incidents.by.helpdesk?helpdesk_id=6002 → tickets del módulo
 *
 * Los IDs internos NO son estables entre instancias (la cola de QA difiere),
 * así que la resolución es por nombre del helpdesk + desambiguación empírica
 * de niveles contra la categoría resuelta. Nada hardcodeado.
 */

/**
 * Tramo de nombre del helpdesk contenedor, normalizado sin acentos/case.
 * Matchea tanto la mesa histórica ("TI_GSM_Mesa de Coord", abreviado o con
 * tilde, y sus homónimos de reporting) como la subdivisión donde viven hoy
 * los tickets: "TI_GSM_MDC AUTSUC" (producción, 2026-09).
 */
const QUEUE_HELPDESK_NAME_PATTERN = /mesa de coord|mdc autsuc/;
/**
 * Muestras de tickets usadas para desambiguar niveles cuando un helpdesk
 * tiene más de uno (probamos la cola y nos quedamos con la que contiene
 * la categoría resuelta).
 */
const PROBE_SAMPLE_SIZE = 100;

/** Cooldown para re-resolver tras una invalidación: evita thrash por render. */
const INVALIDATION_COOLDOWN_MS = 5 * 60_000;

/** Persistencia cross-restart: colas y niveles cambian muy rara vez. */
const QUEUE_CACHE_KEY = "automation.queue_ids";
const QUEUE_CACHE_TTL_MS = 24 * 60 * 60_000;

let cachedQueueIds: number[] | null = null;
let lastInvalidationAt = 0;

/**
 * Override explícito por env. Acepta uno o varios IDs separados por comas
 * (2026-09 conviven dos colas: el helpdesk AUTSUC y su nivel histórico).
 */
function parseQueueOverride(raw: string | undefined): number[] | null {
  if (!raw) {
    return null;
  }

  const ids = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isInteger(id));

  return ids.length > 0 ? [...new Set(ids)] : null;
}

/** Override configurado por env (si existe, no hace falta resolver la topología). */
export function getQueueOverrideIds(): number[] | null {
  return parseQueueOverride(getServerEnv("INVGATE_AUTOMATION_GROUP_ID"));
}

/**
 * Invalida la cola cacheada cuando el discovery deja de encontrar padres
 * (la cola cambió de nivel o el nivel resolvió mal). Con cooldown para no
 * re-resolver en cada render si el problema persiste.
 */
export function invalidateQueueCache(): void {
  const now = Date.now();
  if (now - lastInvalidationAt >= INVALIDATION_COOLDOWN_MS) {
    cachedQueueIds = null;
    deletePersistedCache(QUEUE_CACHE_KEY);
    lastInvalidationAt = now;
  }
}

function listCandidateHelpdesks(
  helpdesks: readonly InvgateHelpdeskNode[],
): InvgateHelpdeskNode[] {
  const candidates = helpdesks.filter(
    (node) =>
      node.name !== null &&
      QUEUE_HELPDESK_NAME_PATTERN.test(normalizeForCompare(node.name)),
  );
  if (candidates.length === 0) {
    throw new Error(
      'No se encontró el helpdesk "Mesa de Coordinación" en /helpdesks: verificá el nombre o configurá INVGATE_AUTOMATION_GROUP_ID.',
    );
  }
  return candidates;
}

/** La cola correcta es la que contiene tickets de la categoría resuelta. */
async function queueContainsCategory(
  queueId: number,
  categoryId: number,
): Promise<boolean> {
  const idsResult = await getIncidentIdsByHelpdesk(queueId);
  if (!idsResult.ok || idsResult.data.length === 0) {
    return false;
  }

  const details = await getIncidents(idsResult.data.slice(0, PROBE_SAMPLE_SIZE));
  if (!details.ok) {
    return false;
  }

  return Object.values(details.data).some(
    (incident) => incident?.category_id === categoryId,
  );
}

function rememberQueues(ids: number[]): number[] {
  cachedQueueIds = ids;
  writePersistedCache(QUEUE_CACHE_KEY, ids, QUEUE_CACHE_TTL_MS);
  return ids;
}

/** Topología ya obtenida por el caller para evitar re-fetchearla. */
export interface PrefetchedQueueTopology {
  helpdesks?: readonly InvgateHelpdeskNode[];
  levels?: readonly InvgateHelpdeskLevelNode[];
}

/**
 * Resuelve las colas de automatizaciones (todas las que contienen la categoría
 * resuelta). Prioridad:
 * 1. Override INVGATE_AUTOMATION_GROUP_ID (uno o varios IDs separados por coma).
 * 2. Cache persistido (24 h) y cache por proceso.
 * 3. Helpdesks candidatos por nombre normalizado (puede haber homónimos de
 *    reporting, p.ej. "REPde_TI_GSM_Mesa de Coord") → el helpdesk en sí y sus
 *    niveles → desambiguación empírica en paralelo: quedan todas las colas que
 *    contienen la categoría (2026-09 conviven dos formatos: padres del workflow
 *    AUTSUC asignados directo al helpdesk 6409 y padres históricos en su nivel
 *    6410). Falla con mensaje visible, nunca con IDs de otra instancia.
 */
export async function resolveAutomationQueueIds(
  categoryId: number,
  prefetched?: PrefetchedQueueTopology,
): Promise<number[]> {
  const override = parseQueueOverride(
    getServerEnv("INVGATE_AUTOMATION_GROUP_ID"),
  );
  if (override) {
    return override;
  }

  if (cachedQueueIds !== null) {
    return cachedQueueIds;
  }

  const persisted = readPersistedCache<number[]>(QUEUE_CACHE_KEY);
  if (
    Array.isArray(persisted) &&
    persisted.length > 0 &&
    persisted.every((id) => Number.isInteger(id))
  ) {
    cachedQueueIds = persisted;
    return persisted;
  }

  const [helpdesksResult, levelsResult] = await Promise.all([
    prefetched?.helpdesks
      ? Promise.resolve({
          ok: true as const,
          status: 200,
          data: [...prefetched.helpdesks],
        })
      : getHelpdesks(),
    prefetched?.levels
      ? Promise.resolve({
          ok: true as const,
          status: 200,
          data: [...prefetched.levels],
        })
      : getHelpdesksAndLevels(),
  ]);

  if (!helpdesksResult.ok) {
    throw new Error(
      `No se pudo obtener el listado de helpdesks de InvGate: ${helpdesksResult.message}`,
    );
  }

  const candidateHelpdesks = listCandidateHelpdesks(helpdesksResult.data);

  const queueIds = candidateHelpdesks.map((helpdesk) => helpdesk.id);

  if (levelsResult.ok) {
    for (const node of levelsResult.data) {
      const isLevel =
        node.type_id === 1 || node.name === null || node.name === undefined;
      const belongsToCandidate =
        !queueIds.includes(node.id) &&
        candidateHelpdesks.some(
          (helpdesk) => helpdesk.id === node.parent_id,
        );
      if (isLevel && belongsToCandidate) {
        queueIds.push(node.id);
      }
    }
  }

  if (queueIds.length === 0) {
    const helpdeskNames = candidateHelpdesks
      .map((helpdesk) => `${helpdesk.id} (${helpdesk.name})`)
      .join(", ");
    throw new Error(
      `Los helpdesks candidatos no tienen niveles en helpdesksandlevels (${helpdeskNames}): no se puede resolver la cola de automatizaciones. Configurá INVGATE_AUTOMATION_GROUP_ID.`,
    );
  }

  const probes = await Promise.all(
    queueIds.map((queueId) => queueContainsCategory(queueId, categoryId)),
  );
  const resolvedQueueIds = queueIds.filter((_, index) => probes[index]);

  if (resolvedQueueIds.length === 0) {
    throw new Error(
      `Ninguna cola candidata (${queueIds.join(", ")}) contiene la categoría ${categoryId} de automatizaciones: verificá la cola o configurá INVGATE_AUTOMATION_GROUP_ID.`,
    );
  }

  return rememberQueues(resolvedQueueIds);
}
