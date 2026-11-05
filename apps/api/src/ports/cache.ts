export interface CacheEntry<T> {
  value: T;
  /** Epoch ms after which the value is stale (but may still be served if the source is down). */
  freshUntil: number;
}

/**
 * Key-value cache. In-memory today; a Redis/ElastiCache adapter replaces it when the API runs
 * as several instances, with no change to callers.
 */
export interface Cache {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  /** Keep the entry for `retainMs` (fresh window plus a stale-serving window). */
  set<T>(key: string, entry: CacheEntry<T>, retainMs: number): Promise<void>;
}
