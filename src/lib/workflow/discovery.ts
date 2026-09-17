import { getIncidentIdsByHelpdesk } from "@lib/invgate/automation/by-helpdesk";
import { getHelpdesks, getHelpdesksAndLevels } from "@lib/invgate/automation/helpdesks";
import { getIncidents } from "@lib/invgate/automation/incidents";
import type { InvgateAutomationIncident } from "@lib/invgate/automation/types";
import {
  readPersistedCache,
  writePersistedCache,
  deletePersistedCache,
} from "@lib/invgate/cache";
import { resolveAutomationCategoryId } from "./category-resolver";
import {
  getQueueOverrideIds,
  invalidateQueueCache,
  resolveAutomationQueueIds,
} from "./queue-resolver";
import { isActiveStatus } from "./automation-status";
import { cleanInvGateTitle, parseAutomationBranchTitle, buildAutomationDisplayName } from "./branch-title";
import { branchNameFromDescription } from "./branch-display";
import { listClosures } from "./closures";
import type { AutomationClosure } from "./closures";
import {
  listTrackedParents,
  removeTrackedParents,
  upsertTrackedParents,
} from "./tracked-parents";
import { upsertAutomationParents } from "./parent-history";

/** Cuántas automatizaciones terminadas se muestran como contexto reciente. */
export const RECENT_CLOSED_LIMIT = 5;

/** TTL del discovery cacheado por proceso: los operadores comparten un scan. */
const DISCOVERY_CACHE_TTL_MS = 5 * 60_000;
/**
 * Ventana de staleness: si el snapshot (en memoria o persistido) es más viejo
 * que el TTL pero está dentro de este tope, se sirve al instante y se refresca
 * en background (stale-while-revalidate). Evita que el usuario que llega justo
 * al vencimiento pague el scan completo.
 */
const DISCOVERY_STALE_MAX_MS = 30 * 60_000;

/** Snapshot persistido en SQLite para sobrevivir restarts del proceso. */
const DISCOVERY_CACHE_KEY = "automation.discovery_snapshot_v2";

/** Memoria de padres finalizados confirmados fuera de la cola (dif). */
const FINALIZED_SEEN_CAP = RECENT_CLOSED_LIMIT * 3;

export interface AutomationSummary {
  id: number;
  prettyId: string;
  branchCode: string | null;
  branchName: string | null;
  displayName: string;
  statusId: number;
  isActive: boolean;
  createdAt: number;
  /** Epoch de la última actualización en InvGate (`last_update`). */
  updatedAt: number;
  closedAt: number | null;
  /** Cierre local en el portal (manual o auto); ausente si no fue cerrado acá. */
  localClosure?: AutomationClosure | null;
}

export type AutomationDiscoveryResult =
  | {
      ok: true;
      current: AutomationSummary | null;
      otherActive: AutomationSummary[];
      recentFinalized: AutomationSummary[];
    }
  | { ok: false; message: string };

interface DiscoverySnapshot {
  current: AutomationSummary | null;
  otherActive: AutomationSummary[];
  recentFinalized: AutomationSummary[];
}

interface CachedDiscovery extends DiscoverySnapshot {
  cachedAt: number;
  expiresAt: number;
}

type PersistedDiscovery = DiscoverySnapshot & { cachedAt: number };

let cachedDiscovery: CachedDiscovery | null = null;
let inflightDiscovery: Promise<AutomationDiscoveryResult> | null = null;

/**
 * Padres finalizados (detectados al salir del scan) para "Recientes". El
 * tracking de activos vive en SQLite (`automation_tracked_parents`).
 */
const finalizedSeen = new Map<number, AutomationSummary>();

function toResult(snapshot: DiscoverySnapshot): AutomationDiscoveryResult {
  return {
    ok: true,
    current: snapshot.current,
    otherActive: snapshot.otherActive,
    recentFinalized: snapshot.recentFinalized,
  };
}

/**
 * Recupera el estado del dif a partir de un snapshot (en memoria o persistido):
 * los finalizados recientes vuelven a `finalizedSeen` para no perder el
 * historial "Recientes" tras un restart. Los activos los repone el tracking
 * persistido en el próximo scan.
 */
function seedFromSnapshot(snapshot: DiscoverySnapshot): void {
  for (const finalized of snapshot.recentFinalized) {
    if (!finalized.isActive) {
      finalizedSeen.set(finalized.id, finalized);
    }
  }
}

function toSummary(incident: InvgateAutomationIncident): AutomationSummary {
  const cleanedTitle = cleanInvGateTitle(incident.title);

  return {
    id: incident.id,
    prettyId: incident.pretty_id,
    ...parseAutomationBranchTitle(cleanedTitle),
    displayName: buildAutomationDisplayName(
      cleanedTitle,
      branchNameFromDescription(incident.description),
    ),
    statusId: incident.status_id,
    isActive: isActiveStatus(incident.status_id),
    createdAt: incident.created_at,
    updatedAt: incident.last_update ?? incident.created_at,
    closedAt: incident.closed_at,
  };
}

function sortByNewestFirst(a: AutomationSummary, b: AutomationSummary): number {
  return b.createdAt - a.createdAt;
}

/** Regla "una por vez": la activa es la automatización NO finalizada más reciente por creación. */
export function pickCurrentAutomation(
  automations: readonly AutomationSummary[],
): AutomationSummary | null {
  const active = automations.filter((item) => item.isActive);
  if (active.length === 0) {
    return null;
  }
  return [...active].sort(sortByNewestFirst)[0];
}

function isUsableIncident(
  incident: InvgateAutomationIncident | undefined,
): incident is InvgateAutomationIncident {
  return (
    typeof incident === "object" &&
    incident !== null &&
    typeof incident.id === "number"
  );
}

/**
 * Scan real (sin cache) de las automatizaciones padre:
 *
 * 1. /incidents.by.helpdesk → IDs de la cola (abiertos y, si el endpoint los
 *    expone, cerrados).
 * 2. Detalles bulk vía /incidents, uniendo los IDs de la cola con los padres
 *    trackeados (persistidos) para no perder los reasignados a otras mesas.
 * 3. Filtro local por categoría resuelta + clasificación activo/finalizado.
 *
 * Categoría y topología de colas se resuelven en paralelo cuando no hay
 * override por env.
 */
async function scanAutomations(): Promise<AutomationDiscoveryResult> {
  const startedAt = Date.now();

  const queueOverride = getQueueOverrideIds();

  const [categoryId, topology] = await Promise.all([
    resolveAutomationCategoryId(),
    queueOverride
      ? Promise.resolve(null)
      : Promise.all([getHelpdesks(), getHelpdesksAndLevels()]),
  ]);

  let queueIds: number[];
  if (queueOverride) {
    queueIds = queueOverride;
  } else {
    const [helpdesksResult, levelsResult] = topology!;
    queueIds = await resolveAutomationQueueIds(categoryId, {
      helpdesks: helpdesksResult.ok ? helpdesksResult.data : undefined,
      levels: levelsResult.ok ? levelsResult.data : undefined,
    });
  }

  /**
   * Colas múltiples (2026-09): conviven dos formatos de padres — el workflow
   * AUTSUC nuevo asigna directo al helpdesk ("TI_GSM_MDC AUTSUC") mientras
   * los padres históricos viven en su nivel. Se listan todas las colas
   * resueltas y se unen los IDs (Set = sin duplicados entre colas).
   */
  const queueIdLists = await Promise.all(
    queueIds.map(async (queueId) => {
      const idsResult = await getIncidentIdsByHelpdesk(queueId);
      if (idsResult.ok) {
        return idsResult.data;
      }
      return null;
    }),
  );

  const okLists = queueIdLists.filter(
    (ids): ids is number[] => ids !== null,
  );

  if (okLists.length === 0) {
    invalidateQueueCache();
    return {
      ok: false,
      message: `No se pudo listar las colas de automatizaciones (${queueIds.join(", ")}): verificá la configuración o el estado de InvGate.`,
    };
  }

  const queueIdsMerged = [...new Set(okLists.flat())];

  /**
   * Los padres reasignados a otra mesa salen de las colas resueltas, pero
   * siguen siendo categoría de automatización: se unen los IDs de la cola con
   * los trackeados (persistidos) para no perderlos.
   */
  const tracked = listTrackedParents();
  const candidateIds = [
    ...new Set([...queueIdsMerged, ...tracked.keys()]),
  ];

  const details = await getIncidents(candidateIds);

  if (!details.ok) {
    return {
      ok: false,
      message: `No se pudieron obtener detalles de solicitudes: ${details.message}`,
    };
  }

  const incidents = Object.values(details.data).filter(isUsableIncident);

  const closures = listClosures();

  const allParents = incidents
    .filter((incident) => incident.category_id === categoryId)
    .map(toSummary)
    .sort(sortByNewestFirst);

  if (allParents.length === 0 && incidents.length > 0) {
    invalidateQueueCache();
  }

  /**
   * Tracking: los padres activos se recuerdan (aunque después cambien de
   * mesa); los finalizados o ausentes se podan. Los finalizados alimentan
   * "Recientes".
   */
  const activeParentIds = new Set<number>();
  const activeEntries: { automationId: number; statusId: number }[] = [];
  for (const parent of allParents) {
    if (parent.isActive) {
      activeParentIds.add(parent.id);
      activeEntries.push({
        automationId: parent.id,
        statusId: parent.statusId,
      });
    }
  }
  upsertTrackedParents(activeEntries);

  const forgotten = [...tracked.keys()].filter(
    (id) => !activeParentIds.has(id),
  );
  if (forgotten.length > 0) {
    removeTrackedParents(forgotten);
    for (const id of forgotten) {
      const incident = incidents.find((item) => item.id === id);
      if (incident && !isActiveStatus(incident.status_id)) {
        finalizedSeen.set(id, toSummary(incident));
      }
    }
  }

  /** Padres con cierre local: dejan de ser "En curso" y pasan a "Finalizadas". */
  const locallyClosed: AutomationSummary[] = [];
  const parents = allParents.filter((parent) => {
    const closure = closures.get(parent.id);
    if (!closure) {
      return true;
    }
    locallyClosed.push({
      ...parent,
      isActive: false,
      closedAt: closure.closedAt,
      localClosure: closure,
    });
    return false;
  });

  for (const id of finalizedSeen.keys()) {
    if (activeParentIds.has(id)) {
      finalizedSeen.delete(id);
    }
  }

  const finalizedEntries = [...finalizedSeen.entries()].sort(
    (a, b) =>
      (b[1].closedAt ?? b[1].createdAt) - (a[1].closedAt ?? a[1].createdAt),
  );
  for (const [id] of finalizedEntries.slice(FINALIZED_SEEN_CAP)) {
    finalizedSeen.delete(id);
  }

  const current = pickCurrentAutomation(parents);
  const otherActive = parents.filter(
    (item) => item.isActive && item.id !== current?.id,
  );
  const recentFinalized = [
    ...finalizedEntries.map(([, summary]) => summary),
    ...locallyClosed,
  ]
    .sort(
      (a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt),
    )
    .slice(0, RECENT_CLOSED_LIMIT);

  /**
   * Historial completo (nunca poda): la vista de automatizaciones lista todos
   * los padres vistos alguna vez, no solo el snapshot reciente.
   */
  const historyById = new Map<number, AutomationSummary>();
  for (const summary of [
    ...parents,
    ...locallyClosed,
    ...finalizedSeen.values(),
  ]) {
    historyById.set(summary.id, summary);
  }
  upsertAutomationParents([...historyById.values()]);

  console.log(
    `[automatizaciones] discovery scan ok (colas ${queueIds.join(",")} · ${queueIdsMerged.length} en cola · ${tracked.size} trackeados · ${activeEntries.length} activos) en ${Date.now() - startedAt} ms`,
  );

  return { ok: true, current, otherActive, recentFinalized };
}

/**
 * Corrida único-vuelo del pipeline: comparte la promesa entre llamadores
 * concurrentes y actualiza memoria + snapshot persistido al terminar.
 */
function runDiscoveryPipeline(): Promise<AutomationDiscoveryResult> {
  if (inflightDiscovery) {
    return inflightDiscovery;
  }

  const promise = (async () => {
    try {
      const result = await scanAutomations();

      if (result.ok) {
        const now = Date.now();
        const snapshot: DiscoverySnapshot = {
          current: result.current,
          otherActive: result.otherActive,
          recentFinalized: result.recentFinalized,
        };
        cachedDiscovery = {
          ...snapshot,
          cachedAt: now,
          expiresAt: now + DISCOVERY_CACHE_TTL_MS,
        };
        writePersistedCache(
          DISCOVERY_CACHE_KEY,
          { ...snapshot, cachedAt: now },
          DISCOVERY_STALE_MAX_MS,
        );
      }

      return result;
    } finally {
      inflightDiscovery = null;
    }
  })();

  inflightDiscovery = promise;
  return promise;
}

/**
 * Descubre las automatizaciones padre vía la cola (nivel de helpdesk) de
 * Mesa de Coordinación, resuelta por queue-resolver. Sirve en memoria o desde
 * el snapshot persistido (stale-while-revalidate) para que el primer render
 * tras un restart no pague el scan completo.
 */
export async function discoverAutomations(): Promise<AutomationDiscoveryResult> {
  const now = Date.now();
  const cached = cachedDiscovery;

  if (cached && cached.expiresAt > now) {
    return toResult(cached);
  }

  if (inflightDiscovery) {
    return inflightDiscovery;
  }

  if (cached && now - cached.cachedAt <= DISCOVERY_STALE_MAX_MS) {
    void runDiscoveryPipeline();
    return toResult(cached);
  }

  const persisted = readPersistedCache<PersistedDiscovery>(DISCOVERY_CACHE_KEY);
  if (
    persisted &&
    typeof persisted.cachedAt === "number" &&
    now - persisted.cachedAt <= DISCOVERY_STALE_MAX_MS
  ) {
    cachedDiscovery = {
      current: persisted.current,
      otherActive: persisted.otherActive ?? [],
      recentFinalized: persisted.recentFinalized ?? [],
      cachedAt: persisted.cachedAt,
      expiresAt: persisted.cachedAt + DISCOVERY_CACHE_TTL_MS,
    };
    seedFromSnapshot(cachedDiscovery);

    if (now - persisted.cachedAt > DISCOVERY_CACHE_TTL_MS) {
      void runDiscoveryPipeline();
    }

    return toResult(cachedDiscovery);
  }

  return runDiscoveryPipeline();
}

/**
 * Invalida el snapshot de discovery (memoria + SQLite) cuando cambia el estado
 * local (cierre/reopertura) para forzar la reclasificación en el próximo render.
 */
export function invalidateDiscoveryCache(): void {
  cachedDiscovery = null;
  deletePersistedCache(DISCOVERY_CACHE_KEY);
}
