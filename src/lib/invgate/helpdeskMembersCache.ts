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
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de cache

/**
 * Obtiene los miembros de una Mesa de Ayuda de InvGate (incluyendo niveles/sub-niveles).
 * Retorna los datos enriquecidos de usuario (id, username, nombre, apellido).
 */
export async function getHelpdeskMembers(helpdeskId: number = 36): Promise<HelpdeskMemberUser[]> {
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
    const helpdesk = all.find((h) => h.id === helpdeskId && !h.level_order);
    const subLevels = all.filter((h) => h.parent_id === helpdeskId && h.level_order !== undefined);

    const memberIdSet = new Set<number>();
    if (helpdesk && helpdesk.members_ids) {
      helpdesk.members_ids.forEach((id) => memberIdSet.add(id));
    }
    subLevels.forEach((level) => {
      if (level.members_ids) {
        level.members_ids.forEach((id) => memberIdSet.add(id));
      }
    });

    const members: HelpdeskMemberUser[] = [];
    const usernamesSet = new Set<string>();

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
        members.push({
          id: u.id,
          username: cleanUsername,
          name: u.name || "",
          lastname: u.lastname || "",
          fullName,
        });
        if (cleanUsername) {
          usernamesSet.add(cleanUsername);
        }
      }
    }

    console.log(`[Helpdesk Members Cache] Mesa #${helpdeskId}: ${memberIdSet.size} IDs encontrados, ${members.length} usuarios resueltos.`);

    cachedMemberUsersMap.set(helpdeskId, members);
    cachedMembersMap.set(helpdeskId, usernamesSet);
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
export async function getHelpdeskMemberUsernames(helpdeskId: number = 36): Promise<Set<string>> {
  await getHelpdeskMembers(helpdeskId);
  return cachedMembersMap.get(helpdeskId) || new Set();
}
