import type { Cache, CacheEntry } from '../../ports/cache.js';

interface Stored {
  entry: CacheEntry<unknown>;
  expiresAt: number;
}

/**
 * Process-local cache, bounded so that unique keys (e.g. random product ids) cannot grow
 * memory without limit. Oldest-inserted entries are evicted first.
 */
export class MemoryCache implements Cache {
  private readonly store = new Map<string, Stored>();

  constructor(private readonly maxEntries = 1000) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const stored = this.store.get(key);
    if (!stored) return undefined;
    if (stored.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Safe: values are only ever written for this key by the same typed caller.
    return stored.entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>, retainMs: number): Promise<void> {
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { entry, expiresAt: Date.now() + retainMs });
  }
}
