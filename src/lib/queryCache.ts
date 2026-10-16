import { getSqliteDataVersion } from "@db/index";

export interface QueryCacheOptions {
  ttlMs: number;
  getDataVersion?: () => number;
  nowFn?: () => number;
}

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

export interface QueryCache<T> {
  getOrCompute: (key: string, fn: () => Promise<T> | T) => Promise<T>;
  invalidate: (key: string) => void;
  invalidateAll: () => void;
}

export function createQueryCache<T>(options: QueryCacheOptions): QueryCache<T> {
  const {
    ttlMs,
    getDataVersion = getSqliteDataVersion,
    nowFn = () => Date.now(),
  } = options;

  const store = new Map<string, CacheEntry<T>>();
  let lastDataVersion = -1;

  function ensureFreshVersion(): void {
    const currentVersion = getDataVersion();
    if (currentVersion !== lastDataVersion) {
      store.clear();
      lastDataVersion = currentVersion;
    }
  }

  return {
    async getOrCompute(key: string, fn: () => Promise<T> | T): Promise<T> {
      ensureFreshVersion();
      const now = nowFn();
      const existing = store.get(key);
      if (existing && now - existing.cachedAt < ttlMs) {
        return existing.value;
      }
      const value = await fn();
      store.set(key, { value, cachedAt: nowFn() });
      return value;
    },
    invalidate(key: string): void {
      store.delete(key);
    },
    invalidateAll(): void {
      store.clear();
    },
  };
}
