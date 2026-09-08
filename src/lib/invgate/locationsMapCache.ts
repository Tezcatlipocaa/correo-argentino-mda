import { invgateGet } from "@lib/invgateClient";
import type { InvgateLocation } from "@/types/invgate";

let locationsMapCache: Map<number, string> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Obtiene o actualiza el mapa de ubicaciones (id -> nombre) desde InvGate.
 * TTL: 1 hora.
 */
export async function getLocationsMap(): Promise<Map<number, string>> {
  const now = Date.now();
  if (locationsMapCache && now - lastFetchTime < CACHE_TTL_MS) {
    return locationsMapCache;
  }

  try {
    const res = await invgateGet<InvgateLocation[]>("locations");
    if (res.ok && res.data) {
      const locations: InvgateLocation[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any).data)
        ? (res.data as any).data
        : [];

      const map = new Map<number, string>();
      for (const loc of locations) {
        if (loc && typeof loc.id === "number" && loc.name) {
          map.set(loc.id, loc.name);
        }
      }
      locationsMapCache = map;
      lastFetchTime = now;
      return map;
    }
  } catch (err) {
    console.error("[InvGate Locations Cache] Error fetching locations:", err);
  }

  return locationsMapCache || new Map<number, string>();
}

/**
 * Invalida el caché de ubicaciones en memoria.
 */
export function invalidateLocationsCache(): void {
  locationsMapCache = null;
  lastFetchTime = 0;
}
