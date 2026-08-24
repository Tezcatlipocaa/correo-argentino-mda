import { invgateGet } from "@lib/invgateClient";
import type { InvgateHelpdeskAndLevel, InvgateUser } from "@/types/invgate";
import { getFullUserMap } from "./userCache";

export interface HelpdeskMemberUser {
  id: number;
  username: string;
  name: string;
  lastname: string;
  fullName: string;
}

let cachedMembersMap: Map<number, Set<string>> = new Map();
let cachedMemberUsersMap: Map<number, HelpdeskMemberUser[]> = new Map();
let cachedMemberIdSetMap: Map<number, Set<number>> = new Map();
let cachedMemberMapById: Map<number, Map<number, HelpdeskMemberUser>> = new Map();
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de cache

/**
 * Obtiene los miembros de una Mesa de Ayuda de InvGate (incluyendo niveles/sub-niveles).
 * Retorna los datos enriquecidos de usuario (id, username, nombre, apellido).
 */
export async function getHelpdeskMembers(helpdeskId: number = 3950): Promise<HelpdeskMemberUser[]> {
  const now = Date.now();
  if (cachedMemberUsersMap.has(helpdeskId) && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedMemberUsersMap.get(helpdeskId) || [];
  }

  try {
    const [result, userMap] = await Promise.all([
      invgateGet<InvgateHelpdeskAndLevel[]>("helpdesksandlevels"),
      getFullUserMap(),
    ]);

    if (!result.ok || !Array.isArray(result.data)) {
      return cachedMemberUsersMap.get(helpdeskId) || [];
    }

    const all = result.data;
    const targetItem = all.find((h) => h.id === helpdeskId);
    const memberIdSet = new Set<number>();

    if (targetItem && targetItem.members_ids) {
      targetItem.members_ids.forEach((id) => memberIdSet.add(id));
    }

    // Include sub-levels if target is a parent helpdesk
    const subLevels = all.filter((h) => h.parent_id === helpdeskId);
    subLevels.forEach((level) => {
      if (level.members_ids) {
        level.members_ids.forEach((id) => memberIdSet.add(id));
      }
    });

    // If target is a level (has parent_id), also include parent's members
    if (targetItem && targetItem.parent_id) {
      const parentItem = all.find((h) => h.id === targetItem.parent_id);
      if (parentItem && parentItem.members_ids) {
        parentItem.members_ids.forEach((id) => memberIdSet.add(id));
      }
    }

    const members: HelpdeskMemberUser[] = [];
    const usernamesSet = new Set<string>();
    const memberIdSetForCache = new Set<number>();
    const memberMapForCache = new Map<number, HelpdeskMemberUser>();

    for (const memberId of memberIdSet) {
      let u = userMap.get(memberId);
      if (!u) {
        try {
          const userRes = await invgateGet<InvgateUser>(`user?id=${memberId}`);
          if (userRes.ok && userRes.data) {
            u = userRes.data;
          }
        } catch {}
      }

      if (u) {
        const cleanUsername = u.username ? u.username.split("@")[0].toLowerCase().trim() : "";
        const fullName = `${u.name || ""} ${u.lastname || ""}`.trim() || u.username || `Usuario #${u.id}`;
        const memberObj: HelpdeskMemberUser = {
          id: u.id,
          username: cleanUsername,
          name: u.name || "",
          lastname: u.lastname || "",
          fullName,
        };
        members.push(memberObj);
        memberIdSetForCache.add(u.id);
        memberMapForCache.set(u.id, memberObj);
        if (cleanUsername) {
          usernamesSet.add(cleanUsername);
        }
      }
    }

    console.log(`[Helpdesk Members Cache] Mesa #${helpdeskId}: ${memberIdSet.size} IDs encontrados, ${members.length} usuarios resueltos.`);

    cachedMemberUsersMap.set(helpdeskId, members);
    cachedMembersMap.set(helpdeskId, usernamesSet);
    cachedMemberIdSetMap.set(helpdeskId, memberIdSetForCache);
    cachedMemberMapById.set(helpdeskId, memberMapForCache);
    lastFetchTime = now;

    return members;
  } catch (err) {
    console.error(`[Helpdesk Members] Error fetching helpdesk #${helpdeskId} members:`, err);
  }

  return cachedMemberUsersMap.get(helpdeskId) || [];
}

/**
 * Obtiene el conjunto de usernames (limpios, sin @dominio) pertenecientes a una Mesa de Ayuda.
 */
export async function getHelpdeskMemberUsernames(helpdeskId: number = 3950): Promise<Set<string>> {
  await getHelpdeskMembers(helpdeskId);
  return cachedMembersMap.get(helpdeskId) || new Set();
}

/**
 * Obtiene el conjunto de IDs numéricos de usuarios pertenecientes a una Mesa de Ayuda.
 */
export async function getHelpdeskMemberIdSet(helpdeskId: number = 3950): Promise<Set<number>> {
  await getHelpdeskMembers(helpdeskId);
  return cachedMemberIdSetMap.get(helpdeskId) || new Set();
}

/**
 * Obtiene el mapa de usuarios (ID -> HelpdeskMemberUser) pertenecientes a una Mesa de Ayuda.
 */
export async function getHelpdeskMemberMap(helpdeskId: number = 3950): Promise<Map<number, HelpdeskMemberUser>> {
  await getHelpdeskMembers(helpdeskId);
  return cachedMemberMapById.get(helpdeskId) || new Map();
}
