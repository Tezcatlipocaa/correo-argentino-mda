import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionResolver,
  type SessionJoinedRow,
} from "./sessionCache";
import { computeFingerprint } from "./sessionFingerprint";

describe("sessionCache — failure modes in isolation", () => {
  const validUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0";
  const validFp = computeFingerprint(validUa);
  let dbCalls = 0;
  let rowsBySessionId = new Map<string, SessionJoinedRow>();

  beforeEach(() => {
    dbCalls = 0;
    rowsBySessionId = new Map();
  });

  const fakeLoader = async (sessionId: string): Promise<SessionJoinedRow | null> => {
    dbCalls += 1;
    return rowsBySessionId.get(sessionId) ?? null;
  };

  it("1. serves cached session within TTL without hitting DB twice, and invalidates immediately on logout", async () => {
    const resolver = createSessionResolver(fakeLoader, 30_000);
    rowsBySessionId.set("sess-1", {
      sessionId: "sess-1",
      userId: 10,
      expiresAt: Date.now() + 60_000,
      fingerprint: validFp,
      username: "operador1",
      role: "agent",
      helpdeskId: 100,
      userActive: true,
      mesaActive: true,
      mesaName: "TI_GSM_MDA TI",
    });

    const first = await resolver.resolve("sess-1", validUa);
    assert.equal(first.status, "ok");
    assert.equal(dbCalls, 1);

    const second = await resolver.resolve("sess-1", validUa);
    assert.equal(second.status, "ok");
    assert.equal(dbCalls, 1, "Must not query DB on cache hit within TTL");

    resolver.invalidateSession("sess-1");
    rowsBySessionId.delete("sess-1");

    const afterLogout = await resolver.resolve("sess-1", validUa);
    assert.equal(
      afterLogout.status,
      "missing_or_expired",
      "Must never serve a session after logout invalidation",
    );
  });

  it("2. rejects an expired session even if it was previously cached", async () => {
    let now = 1_000_000;
    const resolver = createSessionResolver(fakeLoader, 60_000, () => now);
    rowsBySessionId.set("sess-exp", {
      sessionId: "sess-exp",
      userId: 10,
      expiresAt: now + 5_000,
      fingerprint: validFp,
      username: "operador1",
      role: "agent",
      helpdeskId: 100,
      userActive: true,
      mesaActive: true,
      mesaName: "TI_GSM_MDA TI",
    });

    const initial = await resolver.resolve("sess-exp", validUa);
    assert.equal(initial.status, "ok");

    now += 6_000;
    const afterExpiry = await resolver.resolve("sess-exp", validUa);
    assert.equal(
      afterExpiry.status,
      "missing_or_expired",
      "Must reject cached session as soon as expiresAt <= now",
    );
    assert.equal(afterExpiry.hadRow, true);
  });

  it("3. immediately reflects user deactivation or role change when userId is invalidated", async () => {
    const resolver = createSessionResolver(fakeLoader, 30_000);
    rowsBySessionId.set("sess-u2", {
      sessionId: "sess-u2",
      userId: 22,
      expiresAt: Date.now() + 60_000,
      fingerprint: validFp,
      username: "operador2",
      role: "agent",
      helpdeskId: 100,
      userActive: true,
      mesaActive: true,
      mesaName: "TI_GSM_MDA TI",
    });

    const activeRes = await resolver.resolve("sess-u2", validUa);
    assert.equal(activeRes.status, "ok");

    rowsBySessionId.set("sess-u2", {
      ...rowsBySessionId.get("sess-u2")!,
      userActive: false,
    });
    resolver.invalidateUser(22);

    const deactivatedRes = await resolver.resolve("sess-u2", validUa);
    assert.equal(
      deactivatedRes.status,
      "user_inactive",
      "Must expel deactivated user immediately after user invalidation",
    );
  });

  it("4. enforces fail-closed helpdesk visibility when mesa is inactive", async () => {
    const resolver = createSessionResolver(fakeLoader, 30_000);
    rowsBySessionId.set("sess-mesa", {
      sessionId: "sess-mesa",
      userId: 33,
      expiresAt: Date.now() + 60_000,
      fingerprint: validFp,
      username: "operador3",
      role: "agent",
      helpdeskId: 200,
      userActive: true,
      mesaActive: false,
      mesaName: "Mesa Inactiva",
    });

    const res = await resolver.resolve("sess-mesa", validUa);
    assert.equal(res.status, "ok");
    if (res.status === "ok") {
      assert.equal(res.user.helpdeskId, null);
      assert.equal(res.user.helpdeskName, null);
    }
  });

  it("5. rejects fingerprint mismatch even on a cached session", async () => {
    const resolver = createSessionResolver(fakeLoader, 30_000);
    rowsBySessionId.set("sess-fp", {
      sessionId: "sess-fp",
      userId: 44,
      expiresAt: Date.now() + 60_000,
      fingerprint: validFp,
      username: "operador4",
      role: "agent",
      helpdeskId: 100,
      userActive: true,
      mesaActive: true,
      mesaName: "TI_GSM_MDA TI",
    });

    const okRes = await resolver.resolve("sess-fp", validUa);
    assert.equal(okRes.status, "ok");

    const hijackRes = await resolver.resolve(
      "sess-fp",
      "curl/8.0.1 AttackerAgent",
    );
    assert.equal(
      hijackRes.status,
      "invalid_fingerprint",
      "Must reject mismatched User-Agent fingerprint even when session is cached",
    );
  });
});
