import type { Category, Product } from '@catalogue/shared';
import { UpstreamUnavailableError } from '../domain/errors.js';
import type { Cache } from '../ports/cache.js';
import type { Logger } from '../ports/logger.js';
import type { ProductSource } from '../ports/product-source.js';

export interface CachedProductSourceOptions {
  ttlMs: number;
  logger: Logger;
}

/** How long past freshness an entry is kept so it can be served if the source goes down. */
const STALE_RETENTION_FACTOR = 12;

/**
 * Decorator that adds caching to any ProductSource:
 * - fresh hits never reach the source (TTL from config);
 * - single-flight: concurrent misses for a key share one upstream call (no stampede);
 * - serve-stale-on-error: if the source is unavailable, the last good value is returned.
 * Not-found product lookups are cached too, so repeated unknown ids do not hit the source.
 */
export class CachedProductSource implements ProductSource {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly source: ProductSource,
    private readonly cache: Cache,
    private readonly options: CachedProductSourceOptions,
  ) {}

  listProducts(): Promise<Product[]> {
    return this.cached('products', () => this.source.listProducts());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    // null marks "known not to exist" (undefined would read as a cache miss).
    const product = await this.cached(
      `product:${id}`,
      async () => (await this.source.getProduct(id)) ?? null,
    );
    return product ?? undefined;
  }

  listCategories(): Promise<Category[]> {
    return this.cached('categories', () => this.source.listCategories());
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const entry = await this.cache.get<T>(key);
    if (entry && entry.freshUntil > Date.now()) return entry.value;

    // Safe: the in-flight promise for a key was created by this method with the same T.
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const refresh = this.refresh(key, load, entry?.value).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, refresh);
    return refresh;
  }

  private async refresh<T>(key: string, load: () => Promise<T>, stale: T | undefined): Promise<T> {
    try {
      const value = await load();
      const { ttlMs } = this.options;
      await this.cache.set(
        key,
        { value, freshUntil: Date.now() + ttlMs },
        ttlMs * STALE_RETENTION_FACTOR,
      );
      return value;
    } catch (error) {
      if (stale !== undefined && error instanceof UpstreamUnavailableError) {
        this.options.logger.warn({ key, err: error }, 'product source unavailable; serving stale');
        return stale;
      }
      throw error;
    }
  }
}
