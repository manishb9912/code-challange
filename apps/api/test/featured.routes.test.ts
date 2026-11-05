import { afterEach, describe, expect, it } from 'vitest';
import type { Product } from '@catalogue/shared';
import type { App } from '../src/http/types.js';
import { buildTestApp, captureLogs } from './helpers.js';

let app: App;

afterEach(async () => {
  await app.close();
});

const featuredIds = async (ids: string, logStream = captureLogs()) => {
  ({ app } = await buildTestApp({
    env: { FEATURED_PRODUCT_IDS: ids, LOG_LEVEL: 'warn' },
    logStream,
  }));
  const res = await app.inject('/api/v1/products/featured');
  return { res, ids: res.json<Product[]>().map((product) => product.id) };
};

describe('GET /api/v1/products/featured (home page)', () => {
  it('GIVEN 5 chosen products WHEN viewing the home page THEN returns those 5, in the chosen order', async () => {
    const { res, ids } = await featuredIds('31,12,20,10,13');
    expect(res.statusCode).toBe(200);
    expect(ids).toEqual(['31', '12', '20', '10', '13']);
    expect(res.headers['cache-control']).toContain('public');
  });

  it('skips unknown ids with a warning instead of failing', async () => {
    const logs = captureLogs();
    const { res, ids } = await featuredIds('31,999,12', logs);
    expect(res.statusCode).toBe(200);
    expect(ids).toEqual(['31', '12']);
    expect(logs.text()).toContain('featured product not found');
    expect(logs.text()).toContain('"productId":"999"');
  });

  it('shows at most 5 products', async () => {
    const { ids } = await featuredIds('10,11,12,13,14,20,30');
    expect(ids).toEqual(['10', '11', '12', '13', '14']);
  });

  it('ignores duplicate ids', async () => {
    const { ids } = await featuredIds('10,10,11');
    expect(ids).toEqual(['10', '11']);
  });

  it('returns an empty list when nothing is configured', async () => {
    const { res, ids } = await featuredIds('');
    expect(res.statusCode).toBe(200);
    expect(ids).toEqual([]);
  });
});
