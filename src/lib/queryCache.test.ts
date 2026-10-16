import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createQueryCache } from "./queryCache";

describe("createQueryCache failure modes & behavior", () => {
  it("1. computes value on first call and caches subsequent calls within TTL", async () => {
    let calls = 0;
    let version = 10;
    const cache = createQueryCache<string>({
      ttlMs: 5000,
      getDataVersion: () => version,
    });

    const v1 = await cache.getOrCompute("k1", async () => {
      calls++;
      return "value-1";
    });
    const v2 = await cache.getOrCompute("k1", async () => {
      calls++;
      return "value-2";
    });

    assert.equal(v1, "value-1");
    assert.equal(v2, "value-1");
    assert.equal(calls, 1);
  });

  it("2. invalidates automatically when SQLite data_version changes (external write)", async () => {
    let calls = 0;
    let version = 100;
    const cache = createQueryCache<number>({
      ttlMs: 60_000,
      getDataVersion: () => version,
    });

    const first = await cache.getOrCompute("count", async () => ++calls);
    assert.equal(first, 1);

    version = 101;
    const second = await cache.getOrCompute("count", async () => ++calls);
    assert.equal(second, 2);
  });

  it("3. expires entry after ttlMs elapses", async () => {
    let calls = 0;
    let now = 1_000_000;
    const cache = createQueryCache<number>({
      ttlMs: 1000,
      getDataVersion: () => 1,
      nowFn: () => now,
    });

    const first = await cache.getOrCompute("k", async () => ++calls);
    assert.equal(first, 1);

    now += 500;
    const withinTtl = await cache.getOrCompute("k", async () => ++calls);
    assert.equal(withinTtl, 1);

    now += 600;
    const afterTtl = await cache.getOrCompute("k", async () => ++calls);
    assert.equal(afterTtl, 2);
  });

  it("4. supports explicit key and full cache invalidation for same-process writes", async () => {
    let callsA = 0;
    let callsB = 0;
    const cache = createQueryCache<string>({
      ttlMs: 60_000,
      getDataVersion: () => 1,
    });

    await cache.getOrCompute("a", () => `a-${++callsA}`);
    await cache.getOrCompute("b", () => `b-${++callsB}`);

    cache.invalidate("a");
    assert.equal(await cache.getOrCompute("a", () => `a-${++callsA}`), "a-2");
    assert.equal(await cache.getOrCompute("b", () => `b-${++callsB}`), "b-1");

    cache.invalidateAll();
    assert.equal(await cache.getOrCompute("b", () => `b-${++callsB}`), "b-2");
  });
});
