import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";
import { readPersistedCache, writePersistedCache } from "@lib/invgate/cache";

const CATEGORIES_ENDPOINT = "categories";
/** Máximo documentado de page_size para /categories. */
const PAGE_SIZE = 500;
/** Guardia anti-loop: 40 páginas × 500 = 20k categorías es un techo holgado. */
const MAX_PAGES = 40;
/**
 * Páginas que se piden a la vez. La API no informa el total, así que se piden
 * en batches y se corta al primera página parcial: en producción (~6 páginas)
 * el batch cubre el árbol exacto sin over-fetch.
 */
const PAGE_CONCURRENCY = 6;

const CATEGORIES_CACHE_KEY = "invgate.all_categories";
const CATEGORIES_CACHE_TTL_MS = 60 * 60_000; // 1 hora

let memoryCachedCategories: InvgateCategoryNode[] | null = null;
let memoryCacheExpiresAt = 0;

export function clearCategoriesCache(): void {
  memoryCachedCategories = null;
  memoryCacheExpiresAt = 0;
}

/** Shape validado: array plano de nodos con padre opcional. */
export interface InvgateCategoryNode {
  id: number;
  name: string;
  parent_category_id: number | null;
}

/** Acepta el array plano o el envelope {data:[...]} y filtra nodos inválidos. */
function parseCategoriesPage(payload: unknown): InvgateCategoryNode[] {
  const chunk = Array.isArray(payload)
    ? (payload as InvgateCategoryNode[])
    : Array.isArray((payload as { data?: InvgateCategoryNode[] })?.data)
      ? ((payload as { data?: InvgateCategoryNode[] }).data ?? [])
      : [];

  return chunk.filter(
    (node) =>
      node &&
      typeof node.id === "number" &&
      typeof node.name === "string" &&
      node.name.length > 0,
  );
}

/**
 * GET /categories es offset-paginado (page/page_size, máx 500 por página):
 * en producción el árbol supera las 2.8k categorías, así que se recorren
 * todas las páginas (en batches concurrentes) antes de devolver el array.
 * Los resultados se cachean en memoria y SQLite para no repetir escaneos costosos.
 */
export async function getCategories(options?: {
  forceRefresh?: boolean;
}): Promise<InvgateResult<InvgateCategoryNode[]>> {
  const isTest = process.env.NODE_ENV === "test";

  if (!options?.forceRefresh && !isTest) {
    if (memoryCachedCategories && Date.now() < memoryCacheExpiresAt) {
      return { ok: true, status: 200, data: memoryCachedCategories };
    }

    const persisted = readPersistedCache<InvgateCategoryNode[]>(CATEGORIES_CACHE_KEY);
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      memoryCachedCategories = persisted;
      memoryCacheExpiresAt = Date.now() + CATEGORIES_CACHE_TTL_MS;
      return { ok: true, status: 200, data: persisted };
    }
  }

  const all: InvgateCategoryNode[] = [];
  let nextPage = 1;

  while (nextPage <= MAX_PAGES) {
    const pages: number[] = [];
    for (
      let offset = 0;
      offset < PAGE_CONCURRENCY && nextPage + offset <= MAX_PAGES;
      offset++
    ) {
      pages.push(nextPage + offset);
    }

    const results = await Promise.all(
      pages.map((page) =>
        invgateGet<unknown>(
          `${CATEGORIES_ENDPOINT}?page=${page}&page_size=${PAGE_SIZE}`,
        ),
      ),
    );

    let reachedEnd = false;
    for (const result of results) {
      if (!result.ok) {
        return result as InvgateResult<InvgateCategoryNode[]>;
      }

      all.push(...parseCategoriesPage(result.data));

      const rawChunk = Array.isArray(result.data)
        ? (result.data as unknown[]).length
        : Array.isArray((result.data as { data?: unknown[] })?.data)
          ? ((result.data as { data?: unknown[] }).data ?? []).length
          : 0;

      if (rawChunk < PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
    }

    if (reachedEnd) {
      break;
    }

    nextPage += pages.length;
  }

  if (all.length > 0 && !isTest) {
    memoryCachedCategories = all;
    memoryCacheExpiresAt = Date.now() + CATEGORIES_CACHE_TTL_MS;
    writePersistedCache(CATEGORIES_CACHE_KEY, all, CATEGORIES_CACHE_TTL_MS);
  }

  return { ok: true, status: 200, data: all };
}
