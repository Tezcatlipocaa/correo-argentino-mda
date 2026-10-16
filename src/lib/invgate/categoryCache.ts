import { invgateGet } from "@lib/invgateClient";

export interface InvgateCategory {
  id: number;
  name: string;
  parent_id?: number | null;
}

let categoryMapCache: Map<number, string> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Retorna la última subcategoría de una ruta jerárquica (ej. "Sistemas > Hardware > Impresoras" -> "Impresoras").
 */
export function getLastCategoryName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.split(/\s*[\/>>]\s*/);
  return parts[parts.length - 1].trim();
}

/**
 * Obtiene o actualiza el mapa de categorías (id -> nombre completo) desde InvGate.
 */
export async function getCategoryMap(): Promise<Map<number, string>> {
  const now = Date.now();
  if (categoryMapCache && now - lastFetchTime < CACHE_TTL_MS) {
    return categoryMapCache;
  }

  try {
    const res = await invgateGet<any>("categories");
    if (res.ok && res.data) {
      const categories: InvgateCategory[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.data)
        ? res.data.data
        : [];

      const map = new Map<number, string>();
      for (const cat of categories) {
        if (cat && typeof cat.id === "number" && cat.name) {
          map.set(cat.id, cat.name);
        }
      }
      categoryMapCache = map;
      lastFetchTime = now;
      return map;
    }
  } catch (err) {
    console.error("[InvGate Categories Cache] Error fetching categories:", err);
  }

  return categoryMapCache || new Map<number, string>();
}
