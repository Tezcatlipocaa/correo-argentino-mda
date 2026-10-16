import { db, getSqliteDataVersion } from "../db/index";
import { sessions, users, mesas } from "../db/schema";
import { eq } from "drizzle-orm";
import { resolveSessionMesa } from "./helpdeskAccess";
import {
  computeFingerprint,
  isFingerprintValid,
} from "./sessionFingerprint";

export interface SessionJoinedRow {
  sessionId: string;
  userId: number;
  expiresAt: number;
  fingerprint: string | null;
  username: string | null;
  role: string | null;
  helpdeskId: number | null;
  userActive: boolean | null;
  mesaActive: boolean | null;
  mesaName: string | null;
}

export type SessionResolutionResult =
  | {
      status: "ok";
      user: {
        id: number;
        username: string;
        role: string;
        helpdeskId: number | null;
        helpdeskName: string | null;
      };
    }
  | {
      status: "missing_or_expired";
      hadRow: boolean;
    }
  | {
      status: "invalid_fingerprint";
    }
  | {
      status: "user_inactive";
    };

interface CacheEntry {
  row: SessionJoinedRow;
  cachedAt: number;
}

export function createSessionResolver(
  loader: (sessionId: string) => Promise<SessionJoinedRow | null>,
  ttlMs = 15_000,
  nowFn: () => number = () => Date.now(),
  getDataVersion?: () => number,
) {
  const cache = new Map<string, CacheEntry>();
  let lastDataVersion = getDataVersion ? getDataVersion() : 0;

  function checkExternalMutation() {
    if (!getDataVersion) return;
    const currentVersion = getDataVersion();
    if (currentVersion !== lastDataVersion) {
      lastDataVersion = currentVersion;
      cache.clear();
    }
  }

  return {
    async resolve(
      sessionId: string,
      userAgentHeader: string | null | undefined,
    ): Promise<SessionResolutionResult> {
      checkExternalMutation();
      const now = nowFn();
      let row: SessionJoinedRow | null = null;

      const cached = cache.get(sessionId);
      if (cached && now - cached.cachedAt <= ttlMs) {
        row = cached.row;
      } else {
        if (cached) cache.delete(sessionId);
        row = await loader(sessionId);
        if (row) {
          cache.set(sessionId, { row, cachedAt: now });
        }
      }

      if (!row) {
        return { status: "missing_or_expired", hadRow: false };
      }

      if (row.expiresAt <= now) {
        cache.delete(sessionId);
        return { status: "missing_or_expired", hadRow: true };
      }

      const currentFingerprint = computeFingerprint(userAgentHeader ?? null);
      if (!isFingerprintValid(row.fingerprint, currentFingerprint)) {
        cache.delete(sessionId);
        return { status: "invalid_fingerprint" };
      }

      if (row.username == null) {
        cache.delete(sessionId);
        return { status: "missing_or_expired", hadRow: true };
      }

      if (!row.userActive) {
        cache.delete(sessionId);
        return { status: "user_inactive" };
      }

      const mesa = resolveSessionMesa({
        helpdeskId: row.helpdeskId,
        helpdeskName: row.mesaName ?? null,
        mesaActive: row.mesaActive,
      });

      return {
        status: "ok",
        user: {
          id: row.userId,
          username: row.username,
          role: row.role ?? "agent",
          helpdeskId: mesa.helpdeskId,
          helpdeskName: mesa.helpdeskName,
        },
      };
    },

    invalidateSession(sessionId: string) {
      cache.delete(sessionId);
    },

    invalidateUser(userId: number) {
      for (const [key, entry] of cache.entries()) {
        if (entry.row.userId === userId) {
          cache.delete(key);
        }
      }
    },

    invalidateAll() {
      cache.clear();
    },
  };
}

async function loadSessionJoinedFromDb(
  sessionId: string,
): Promise<SessionJoinedRow | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      fingerprint: sessions.fingerprint,
      username: users.username,
      role: users.role,
      helpdeskId: users.helpdeskId,
      userActive: users.active,
      mesaActive: mesas.active,
      mesaName: mesas.name,
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .leftJoin(mesas, eq(users.helpdeskId, mesas.invgateId))
    .where(eq(sessions.id, sessionId));

  return row ?? null;
}

const defaultResolver = createSessionResolver(
  loadSessionJoinedFromDb,
  15_000,
  () => Date.now(),
  getSqliteDataVersion,
);

export function resolveSessionUser(
  sessionId: string,
  userAgentHeader?: string | null,
): Promise<SessionResolutionResult> {
  return defaultResolver.resolve(sessionId, userAgentHeader);
}

export function invalidateSessionCache(sessionId: string): void {
  defaultResolver.invalidateSession(sessionId);
}

export function invalidateUserSessionsCache(userId: number): void {
  defaultResolver.invalidateUser(userId);
}

export function invalidateAllSessionsCache(): void {
  defaultResolver.invalidateAll();
}
