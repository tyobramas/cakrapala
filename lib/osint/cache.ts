// lib/osint/cache.ts
// ─────────────────────────────────────────────────────────────────────────────
// In-memory TTL cache with in-flight request deduplication.
//
// Designed for serverless: treat cold starts as expected — the cache is an
// optimisation, not a guarantee.  The interface is kept narrow so a future
// swap to Upstash Redis only requires a new implementation of CacheStore.
// ─────────────────────────────────────────────────────────────────────────────

/** Abstract cache store interface — swap implementation to use Redis etc. */
export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  /** Dedup: if a fetch for `key` is already in flight, return its promise. */
  dedup<T>(key: string, factory: () => Promise<T>, ttlMs: number): Promise<T>;
}

// ── Entry ───────────────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number; // Date.now() + ttlMs
}

// ── In-memory implementation ────────────────────────────────────────────────

class InMemoryCache implements CacheStore {
  private store = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async dedup<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    // Return cached value if still valid.
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    // Return in-flight promise if one exists.
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    // Start new fetch, store promise for dedup.
    const promise = factory()
      .then((result) => {
        this.set(key, result, ttlMs);
        return result;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** For testing: forcibly expire all entries. */
  _clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

/**
 * Module-level singleton.  In serverless, each cold-start gets a fresh
 * instance — this is by design.  Hot invocations within the same process
 * share the cache.
 */
export const cache: CacheStore = new InMemoryCache();

/**
 * Expose concrete class for tests that need to call `_clear()`.
 * Production code should use the `cache` singleton via the CacheStore
 * interface.
 */
export function createCache(): InMemoryCache {
  return new InMemoryCache();
}
