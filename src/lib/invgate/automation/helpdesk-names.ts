import { getHelpdesks, getHelpdesksAndLevels } from "./helpdesks";
import { readPersistedCache, writePersistedCache } from "@lib/invgate/cache";
import { usersCacheTtlMs } from "./cache-config";

/**
 * Resolución de nombres de sector para las tareas.
 *
 * En InvGate las tareas se asignan a un NIVEL (`helpdesk_id` = helpdesksandlevels
 * type_id=1), que no tiene `name`: el nombre del sector vive en el helpdesk
 * padre (`parent_id`). Se cachea el mapa nivel→sector por proceso.
 */

const CACHE_TTL_MS = 30 * 60_000;

interface SectorMap {
  /** helpdeskId → nombre del helpdesk. */
  names: Map<number, string>;
  /** nivelId → helpdeskId. */
  levelToHelpdesk: Map<number, number>;
  loadedAt: number;
}

let cached: SectorMap | null = null;
let inflight: Promise<SectorMap | null> | null = null;

/** Snapshot persistido del mapa de sectores (sobrevive restarts). */
const SECTOR_CACHE_KEY = "automation.sector_map";

interface PersistedSectorMap {
  names: [number, string][];
  levelToHelpdesk: [number, number][];
  loadedAt: number;
}

function persistSectorMap(map: SectorMap): void {
  writePersistedCache(
    SECTOR_CACHE_KEY,
    {
      names: [...map.names.entries()],
      levelToHelpdesk: [...map.levelToHelpdesk.entries()],
      loadedAt: map.loadedAt,
    } satisfies PersistedSectorMap,
    usersCacheTtlMs(),
  );
}

function readPersistedSectorMap(): SectorMap | null {
  const persisted = readPersistedCache<PersistedSectorMap>(SECTOR_CACHE_KEY);
  if (!persisted || !Array.isArray(persisted.names)) {
    return null;
  }
  return {
    names: new Map(persisted.names),
    levelToHelpdesk: new Map(persisted.levelToHelpdesk),
    loadedAt:
      typeof persisted.loadedAt === "number" ? persisted.loadedAt : Date.now(),
  };
}

async function buildSectorMap(): Promise<SectorMap | null> {
  const [helpdesksResult, levelsResult] = await Promise.all([
    getHelpdesks(),
    getHelpdesksAndLevels(),
  ]);

  if (!helpdesksResult.ok || !levelsResult.ok) {
    return null;
  }

  const names = new Map<number, string>();
  for (const helpdesk of helpdesksResult.data) {
    if (helpdesk.name) {
      names.set(helpdesk.id, helpdesk.name);
    }
  }

  const levelToHelpdesk = new Map<number, number>();
  for (const node of levelsResult.data) {
    if (node.parent_id != null) {
      levelToHelpdesk.set(node.id, node.parent_id);
    }
  }

  return { names, levelToHelpdesk, loadedAt: Date.now() };
}

async function loadSectorMap(): Promise<SectorMap | null> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached;
  }
  if (inflight) {
    return inflight;
  }

  const persisted = readPersistedSectorMap();
  if (persisted) {
    // `readPersistedCache` ya validó el TTL persistido (24 h): se hidrata y se
    // reinicia la ventana de memoria para no reconstruir antes de tiempo.
    cached = { ...persisted, loadedAt: Date.now() };
    return cached;
  }

  inflight = (async () => {
    try {
      const map = await buildSectorMap();
      if (map) {
        cached = map;
        persistSectorMap(map);
      }
      return map ?? cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Resuelve id (nivel o helpdesk) → nombre de sector. Nunca lanza: ante error
 * devuelve un mapa vacío.
 */
export async function resolveSectorNames(
  ids: readonly number[],
): Promise<Map<number, string>> {
  const resolved = new Map<number, string>();
  const unique = [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (unique.length === 0) {
    return resolved;
  }

  const map = await loadSectorMap();
  if (!map) {
    return resolved;
  }

  for (const id of unique) {
    const name =
      map.names.get(id) ?? map.names.get(map.levelToHelpdesk.get(id) ?? -1);
    if (name) {
      resolved.set(id, name);
    }
  }
  return resolved;
}
