import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invgateCache } from "@/db/schema";

/**
 * Cache key/value persistido en SQLite para resoluciones costosas de InvGate.
 * Los caches en memoria viven por proceso; este los respalda para que un
 * restart no vuelva a pagar el escaneo completo en la primera carga.
 *
 * Nunca lanza: ante cualquier error de DB degrada a "sin cache" y las
 * resolver funcionan como antes (caminos lentos).
 */
export function readPersistedCache<T>(key: string): T | null {
  try {
    const row = db
      .select()
      .from(invgateCache)
      .where(eq(invgateCache.key, key))
      .get();

    if (!row || row.expiresAt <= Date.now()) {
      return null;
    }

    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function writePersistedCache(
  key: string,
  value: unknown,
  ttlMs: number,
): void {
  try {
    const serialized = JSON.stringify(value);
    const expiresAt = Date.now() + ttlMs;

    db.insert(invgateCache)
      .values({ key, value: serialized, expiresAt })
      .onConflictDoUpdate({
        target: invgateCache.key,
        set: { value: serialized, expiresAt },
      })
      .run();
  } catch {
    return;
  }
}

export function deletePersistedCache(key: string): void {
  try {
    db.delete(invgateCache).where(eq(invgateCache.key, key)).run();
  } catch {
    return;
  }
}
