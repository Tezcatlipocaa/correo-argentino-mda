import { getApprovedTitlesList } from "@lib/qualityTitleMatcher";
import { normalizeTitle } from "@lib/titleNormalizer";

/**
 * Matching de títulos de tickets contra el catálogo homologado del portal
 * (`titles`). Sirve para mostrar el título **canónico** cuando el ticket viene
 * mal escrito (p. ej. "Mosaic- nohost" → "Mosaic - No host"). Conservador:
 * solo sugiere cuando la similitud supera el umbral.
 *
 * `matchCanonicalTitle` es pura (testeable); `loadTitleIndex` cachea el índice
 * del catálogo en memoria.
 */

const FUZZY_THRESHOLD = 0.85;
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface TitleIndex {
  names: string[];
  /** Versión sin espacios de `normalizeTitle` de cada nombre. */
  compact: string[];
}

/** Índice del catálogo (precomputa la forma compacta de cada título). */
export function buildTitleIndex(names: readonly string[]): TitleIndex {
  return {
    names: [...names],
    compact: names.map((name) => compactTitle(name)),
  };
}

/** `normalizeTitle` + sin espacios: "No host" → "nohost". */
export function compactTitle(value: string): string {
  return normalizeTitle(value).replace(/\s+/g, "");
}

/** Distancia de Levenshtein (dos filas). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similitud 0..1 entre dos cadenas (1 = idénticas). */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export interface TitleMatch {
  canonical: string | null;
  confidence: number;
}

/**
 * Busca el título canónico más cercano. Tiers: exacto → normalizado →
 * compacto (sin espacios) → Levenshtein del compacto (≥ umbral). `null` si no
 * hay match seguro.
 */
export function matchCanonicalTitle(
  raw: string,
  index: TitleIndex,
): TitleMatch {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || index.names.length === 0) {
    return { canonical: null, confidence: 0 };
  }

  const normalized = normalizeTitle(trimmed);
  const compact = normalized.replace(/\s+/g, "");
  const prefix = compact.slice(0, 3);

  let best: TitleMatch = { canonical: null, confidence: 0 };

  for (let i = 0; i < index.names.length; i += 1) {
    const name = index.names[i];

    if (name.trim() === trimmed) {
      return { canonical: name, confidence: 1 };
    }

    const nameCompact = index.compact[i];
    if (nameCompact === compact) {
      if (best.confidence < 0.95) best = { canonical: name, confidence: 0.95 };
      continue;
    }

    if (normalizeTitle(name) === normalized) {
      if (best.confidence < 0.9) best = { canonical: name, confidence: 0.9 };
      continue;
    }

    // Prefiltro por prefijo: evita Levenshtein contra todo el catálogo.
    if (nameCompact.slice(0, 3) !== prefix) continue;

    const score = similarity(compact, nameCompact);
    if (score >= FUZZY_THRESHOLD && score > best.confidence) {
      best = { canonical: name, confidence: score };
    }
  }

  return best;
}

let cachedIndex: { index: TitleIndex; loadedAt: number } | null = null;
let inflightIndex: Promise<TitleIndex> | null = null;

/** Índice del catálogo cacheado (30 min). Nunca lanza: degrada a índice vacío. */
export async function loadTitleIndex(): Promise<TitleIndex> {
  const now = Date.now();
  if (cachedIndex && now - cachedIndex.loadedAt < CACHE_TTL_MS) {
    return cachedIndex.index;
  }
  if (inflightIndex) return inflightIndex;

  inflightIndex = (async () => {
    try {
      const names = await getApprovedTitlesList();
      const index = buildTitleIndex(names);
      cachedIndex = { index, loadedAt: Date.now() };
      return index;
    } catch {
      const empty = buildTitleIndex([]);
      cachedIndex = { index: empty, loadedAt: Date.now() };
      return empty;
    } finally {
      inflightIndex = null;
    }
  })();

  return inflightIndex;
}
