import { getHelpdesks, getHelpdesksAndLevels } from "./helpdesks";

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
  inflight = (async () => {
    try {
      const map = await buildSectorMap();
      if (map) {
        cached = map;
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
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
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
