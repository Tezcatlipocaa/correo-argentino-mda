import { invgateGet } from "@lib/invgateClient";
import type { InvgateUser } from "@/types/invgate";

/**
 * Resolución de nombres de usuarios de InvGate para autores de comentarios.
 *
 * El endpoint `/users?ids[]=...` devuelve solo los IDs pedidos (verificado en
 * producción), así que se resuelven en un único bulk por detalle. El resultado
 * se cachea por proceso con TTL largo: los nombres cambian rara vez.
 */

const USERS_ENDPOINT = "users";
const CHUNK_SIZE = 100;
const CACHE_TTL_MS = 30 * 60_000;

interface CacheEntry {
  name: string;
  at: number;
}

const userNameCache = new Map<number, CacheEntry>();

/** Nombre display: "Nombre Apellido" → username → "Usuario #id". */
export function makeUserDisplayName(user: InvgateUser): string {
  const full = [user.name, user.lastname]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();
  if (full) {
    return full;
  }
  if (user.username) {
    return user.username;
  }
  return `Usuario #${user.id}`;
}

/**
 * Normaliza la respuesta de /users, que puede venir como array plano o como
 * diccionario indexado por ID (mismo patrón que /users.by).
 */
function extractUsers(raw: unknown): InvgateUser[] {
  if (Array.isArray(raw)) {
    return raw as InvgateUser[];
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.users)) {
      return record.users as InvgateUser[];
    }
    if (Array.isArray(record.data)) {
      return record.data as InvgateUser[];
    }
    if (record.data && typeof record.data === "object") {
      return Object.values(record.data as Record<string, InvgateUser>);
    }
    return Object.values(record as Record<string, InvgateUser>).filter(
      (value) => value && typeof value === "object" && "id" in value,
    );
  }
  return [];
}

/**
 * Resuelve id → nombre display. Nunca lanza: ante error de red devuelve lo que
 * haya en cache. Solo se piden los ids desconocidos.
 */
export async function getUsersByIds(
  ids: readonly number[],
): Promise<Map<number, string>> {
  const resolved = new Map<number, string>();
  const now = Date.now();
  const missing: number[] = [];

  for (const id of new Set(ids)) {
    if (!Number.isInteger(id) || id <= 0) {
      continue;
    }
    const cached = userNameCache.get(id);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      resolved.set(id, cached.name);
    } else {
      missing.push(id);
    }
  }

  for (let index = 0; index < missing.length; index += CHUNK_SIZE) {
    const chunk = missing.slice(index, index + CHUNK_SIZE);
    const search = new URLSearchParams();
    chunk.forEach((id) => search.append("ids[]", String(id)));
    search.append("include_disabled", "true");

    const result = await invgateGet<unknown>(
      `${USERS_ENDPOINT}?${search.toString()}`,
    );
    if (!result.ok) {
      continue;
    }

    for (const user of extractUsers(result.data)) {
      if (!user || typeof user.id !== "number") {
        continue;
      }
      const name = makeUserDisplayName(user);
      userNameCache.set(user.id, { name, at: Date.now() });
      resolved.set(user.id, name);
    }
  }

  return resolved;
}
