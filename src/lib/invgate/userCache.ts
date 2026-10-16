import { invgateGet } from "@lib/invgateClient";
import type { InvgateUser } from "@/types/invgate";

let userMapCache: Map<number, string> | null = null;
let fullUserMapCache: Map<number, InvgateUser> | null = null;
let lastUserFetchTime = 0;
const USER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Obtiene o actualiza el mapa completo de usuarios de InvGate (id -> InvgateUser).
 */
export async function getFullUserMap(): Promise<Map<number, InvgateUser>> {
  const now = Date.now();
  if (fullUserMapCache && now - lastUserFetchTime < USER_CACHE_TTL_MS) {
    return fullUserMapCache;
  }

  try {
    const res = await invgateGet<any>("users", 30000);
    if (res.ok && res.data) {
      const users: InvgateUser[] = Array.isArray(res.data)
        ? res.data
        : (res.data && Array.isArray(res.data.data) ? res.data.data : []);

      const nameMap = new Map<number, string>();
      const fullMap = new Map<number, InvgateUser>();

      for (const u of users) {
        if (u && typeof u.id === "number") {
          const fullName = `${u.name || ""} ${u.lastname || ""}`.trim() || u.username || `Usuario #${u.id}`;
          nameMap.set(u.id, fullName);
          fullMap.set(u.id, u);
        }
      }

      userMapCache = nameMap;
      fullUserMapCache = fullMap;
      lastUserFetchTime = now;
      return fullMap;
    }
  } catch (err) {
    console.error("[InvGate Users Cache] Error fetching users:", err);
  }

  return fullUserMapCache || new Map<number, InvgateUser>();
}

/**
 * Obtiene o actualiza el mapa de usuarios de InvGate (id -> nombre completo).
 */
export async function getUserMap(): Promise<Map<number, string>> {
  await getFullUserMap();
  return userMapCache || new Map<number, string>();
}
