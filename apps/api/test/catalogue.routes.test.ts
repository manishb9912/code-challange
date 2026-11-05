import { afterEach, describe, expect, it } from 'vitest';
import type { CategoryProducts, ErrorEnvelope, Page, Product } from '@catalogue/shared';
import type { App } from '../src/http/types.js';
import { buildTestApp } from './helpers.js';
import type { InMemoryProductSource } from './in-memory-product-source.js';

let app: App;
let source: InMemoryProductSource;

async function start(env: Record<string, string> = {}) {
  ({ app, source } = await buildTestApp({ env }));
}

afterEach(async () => {
  await app.close();
});

const ids = (products: Product[]) => products.map((product) => product.id);

describe('GET /api/v1/categories', () => {
  it('lists categories with public cache headers and an ETag', async () => {
    await start();
    const res = await app.inject('/api/v1/categories');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { slug: 'electronics', name: 'Electronics' },
      { slug: 'jewelery', name: 'Jewellery' },
      { slug: 'mens-clothing', name: "Men's Clothing" },
    ]);
    expect(res.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=300');
    expect(res.headers.etag).toBeDefined();
  });

  it('answers 304 when the client already has the current version', async () => {
    await start();
    const first = await app.inject('/api/v1/categories');
    const second = await app.inject({
      url: '/api/v1/categories',
      headers: { 'if-none-match': String(first.headers.etag) },
    });
    expect(second.statusCode).toBe(304);
  });
});

describe('GET /api/v1/categories/:slug/products', () => {
  it('shows top rated products for the category and the additional products', async () => {
    await start();
    const res = await app.inject('/api/v1/categories/electronics/products');
    const body = res.json<CategoryProducts>();

    expect(res.statusCode).toBe(200);
    expect(body.category).toEqual({ slug: 'electronics', name: 'Electronics' });
    expect(ids(body.topRated)).toEqual(['11', '10', '12']);
    expect(ids(body.others.items)).toEqual(['14', '13']);
    expect(body.others).toMatchObject({ total: 2, limit: 24, offset: 0 });
  });

  it('never repeats a top rated product in the additional products', async () => {
    await start();
    const body = (
      await app.inject('/api/v1/categories/mens-clothing/products')
    ).json<CategoryProducts>();
    const overlap = ids(body.others.items).filter((id) => ids(body.topRated).includes(id));
    expect(overlap).toEqual([]);
  });

  it('paginates the additional products', async () => {
    await start();
    const body = (
      await app.inject('/api/v1/categories/electronics/products?limit=1&offset=1')
    ).json<CategoryProducts>();
    expect(ids(body.others.items)).toEqual(['13']);
    expect(body.others).toMatchObject({ total: 2, limit: 1, offset: 1 });
  });

  it('returns 404 for an unknown category', async () => {
    await start();
    const res = await app.inject('/api/v1/categories/garden/products');
    expect(res.statusCode).toBe(404);
    expect(res.json<ErrorEnvelope>().error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Category not found',
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['a slug with illegal characters', '/api/v1/categories/men%27s%20clothing/products'],
    ['a traversal attempt', '/api/v1/categories/..%2F..%2Fetc/products'],
    ['a limit above the max', '/api/v1/categories/electronics/products?limit=101'],
  ])('returns 400 for %s', async (_label, url) => {
    await start();
    const res = await app.inject(url);
    expect(res.statusCode).toBe(400);
    expect(res.json<ErrorEnvelope>().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/products?q=', () => {
  it('only returns products with text matching the search term', async () => {
    await start();
    const res = await app.inject('/api/v1/products?q=samsung%20monitor');
    const body = res.json<Page<Product>>();

    expect(res.statusCode).toBe(200);
    expect(ids(body.items)).toEqual(['13']);
    expect(body.total).toBe(1);
  });

  it('returns an empty page when nothing matches', async () => {
    await start();
    const body = (await app.inject('/api/v1/products?q=zzz')).json<Page<Product>>();
    expect(body).toEqual({ items: [], total: 0, limit: 24, offset: 0 });
  });

  it('treats regex characters literally', async () => {
    await start();
    const res = await app.inject(`/api/v1/products?q=${encodeURIComponent('C++')}`);
    expect(ids(res.json<Page<Product>>().items)).toEqual(['14']);
  });

  it.each([
    ['a missing term', '/api/v1/products'],
    ['a blank term', '/api/v1/products?q=%20%20'],
    ['a term over 100 characters', `/api/v1/products?q=${'a'.repeat(101)}`],
    ['a limit over 100', '/api/v1/products?q=monitor&limit=500'],
  ])('returns 400 with field details for %s', async (_label, url) => {
    await start();
    const res = await app.inject(url);
    const { error } = res.json<ErrorEnvelope>();
    expect(res.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/products/:id', () => {
  it('returns the product details', async () => {
    await start();
    const res = await app.inject('/api/v1/products/12');
    expect(res.statusCode).toBe(200);
    expect(res.json<Product>()).toMatchObject({
      id: '12',
      title: 'Acer 21.5 inch Monitor',
      price: { amount: 10, currency: 'USD' },
      category: { slug: 'electronics', name: 'Electronics' },
    });
  });

  it('returns 404 for an unknown product', async () => {
    await start();
    const res = await app.inject('/api/v1/products/999');
    expect(res.statusCode).toBe(404);
    expect(res.json<ErrorEnvelope>().error.code).toBe('NOT_FOUND');
  });

  it.each(['bad..id', '%3Cscript%3E', 'a'.repeat(65)])('returns 400 for id %j', async (id) => {
    await start();
    expect((await app.inject(`/api/v1/products/${id}`)).statusCode).toBe(400);
  });
});

describe('when the product source is down', () => {
  it('returns 503 with a generic message if nothing is cached', async () => {
    await start();
    source.failing = true;
    const res = await app.inject('/api/v1/categories');
    expect(res.statusCode).toBe(503);
    expect(res.json<ErrorEnvelope>().error).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Products are temporarily unavailable. Please try again shortly.',
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('keeps serving cached data', async () => {
    await start();
    await app.inject('/api/v1/categories');
    source.failing = true;
    expect((await app.inject('/api/v1/categories')).statusCode).toBe(200);
  });
});

describe('ops probes', () => {
  it('reports ready when products can be served', async () => {
    await start();
    expect((await app.inject('/api/v1/ready')).json()).toEqual({ status: 'ready' });
  });

  it('reports not ready (503) when the source is down and the cache is cold', async () => {
    await start();
    source.failing = true;
    expect((await app.inject('/api/v1/ready')).statusCode).toBe(503);
  });

  it('health stays up regardless of the upstream', async () => {
    await start();
    source.failing = true;
    expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
  });
});
