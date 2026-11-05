import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@catalogue/shared';
import { UpstreamUnavailableError } from '../domain/errors.js';
import type { ProductSource } from '../ports/product-source.js';
import { product, silentLogger } from '../../test/fixtures.js';
import { CachedProductSource } from './cached-product-source.js';
import { MemoryCache } from './memory-cache/memory-cache.js';

const TTL_MS = 60_000;
const catalogue: Product[] = [product({ id: '1' }), product({ id: '2' })];

function setup() {
  const upstream = {
    listProducts: vi.fn<ProductSource['listProducts']>().mockResolvedValue(catalogue),
    getProduct: vi.fn<ProductSource['getProduct']>().mockResolvedValue(catalogue[0]),
    listCategories: vi.fn<ProductSource['listCategories']>().mockResolvedValue([]),
  };
  const logger = silentLogger();
  const cached = new CachedProductSource(upstream, new MemoryCache(), { ttlMs: TTL_MS, logger });
  return { upstream, cached, logger };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CachedProductSource', () => {
  it('serves repeat reads from cache within the TTL', async () => {
    const { upstream, cached } = setup();
    await cached.listProducts();
    vi.advanceTimersByTime(TTL_MS - 1);
    await cached.listProducts();
    expect(upstream.listProducts).toHaveBeenCalledTimes(1);
  });

  it('refreshes from the source once the TTL expires', async () => {
    const { upstream, cached } = setup();
    await cached.listProducts();
    vi.advanceTimersByTime(TTL_MS + 1);
    await cached.listProducts();
    expect(upstream.listProducts).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent misses into a single upstream call (single-flight)', async () => {
    const { upstream, cached } = setup();
    const results = await Promise.all(Array.from({ length: 10 }, () => cached.listProducts()));
    expect(upstream.listProducts).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result === catalogue)).toBe(true);
  });

  it('serves stale data and logs a warning when the source is down', async () => {
    const { upstream, cached, logger } = setup();
    await cached.listProducts();
    vi.advanceTimersByTime(TTL_MS + 1);
    upstream.listProducts.mockRejectedValueOnce(new UpstreamUnavailableError('timeout'));

    expect(await cached.listProducts()).toBe(catalogue);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'products' }),
      expect.stringContaining('stale'),
    );
  });

  it('fails when the source is down and nothing is cached', async () => {
    const { upstream, cached } = setup();
    upstream.listProducts.mockRejectedValueOnce(new UpstreamUnavailableError('timeout'));
    await expect(cached.listProducts()).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('does not mask programming errors with stale data', async () => {
    const { upstream, cached } = setup();
    await cached.listProducts();
    vi.advanceTimersByTime(TTL_MS + 1);
    upstream.listProducts.mockRejectedValueOnce(new TypeError('bug'));
    await expect(cached.listProducts()).rejects.toBeInstanceOf(TypeError);
  });

  it('caches "not found" so repeated unknown ids do not reach the source', async () => {
    const { upstream, cached } = setup();
    upstream.getProduct.mockResolvedValue(undefined);
    expect(await cached.getProduct('404')).toBeUndefined();
    expect(await cached.getProduct('404')).toBeUndefined();
    expect(upstream.getProduct).toHaveBeenCalledTimes(1);
  });

  it('caches each product id separately', async () => {
    const { upstream, cached } = setup();
    await cached.getProduct('1');
    await cached.getProduct('2');
    await cached.getProduct('1');
    expect(upstream.getProduct).toHaveBeenCalledTimes(2);
  });
});

describe('MemoryCache', () => {
  it('drops entries after their retention period', async () => {
    const cache = new MemoryCache();
    await cache.set('k', { value: 1, freshUntil: 0 }, 1000);
    vi.advanceTimersByTime(1001);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('evicts the oldest entry when full, bounding memory', async () => {
    const cache = new MemoryCache(2);
    await cache.set('a', { value: 1, freshUntil: 0 }, 1000);
    await cache.set('b', { value: 2, freshUntil: 0 }, 1000);
    await cache.set('c', { value: 3, freshUntil: 0 }, 1000);
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('c')).toMatchObject({ value: 3 });
  });
});
