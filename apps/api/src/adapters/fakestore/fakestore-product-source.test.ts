import { describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableError } from '../../domain/errors.js';
import { fakeStoreProduct, silentLogger } from '../../../test/fixtures.js';
import { FakeStoreProductSource, type FakeStoreOptions } from './fakestore-product-source.js';

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

const respond = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

function source(fetchFn: FetchStub, overrides: Partial<FakeStoreOptions> = {}) {
  const logger = silentLogger();
  const adapter = new FakeStoreProductSource({
    baseUrl: 'https://fakestoreapi.com',
    timeoutMs: 5000,
    maxConcurrency: 5,
    imageHostAllowlist: ['fakestoreapi.com'],
    logger,
    fetchFn,
    ...overrides,
  });
  return { adapter, logger };
}

function requestedUrl(fetchFn: FetchStub, call = 0): string | undefined {
  const input = fetchFn.mock.calls[call]?.[0];
  if (input instanceof URL) return input.href;
  return typeof input === 'string' ? input : input?.url;
}

describe('FakeStoreProductSource', () => {
  it('lists products mapped to the domain model', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respond([fakeStoreProduct()]));
    const { adapter } = source(fetchFn);

    const products = await adapter.listProducts();

    expect(requestedUrl(fetchFn)).toBe('https://fakestoreapi.com/products');
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ id: '1', category: { slug: 'mens-clothing' } });
  });

  it('drops malformed items, logs a warning, and keeps the rest', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respond([fakeStoreProduct(), { id: 2, title: 42 }]));
    const { adapter, logger } = source(fetchFn);

    expect(await adapter.listProducts()).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1 }),
      'dropped malformed upstream product',
    );
  });

  it('gets one product by id', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respond(fakeStoreProduct({ id: 7 })));
    const { adapter } = source(fetchFn);

    expect(await adapter.getProduct('7')).toMatchObject({ id: '7' });
    expect(requestedUrl(fetchFn)).toBe('https://fakestoreapi.com/products/7');
  });

  it('treats Fake Store\'s empty 200 body as "not found"', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respond(''));
    expect(await source(fetchFn).adapter.getProduct('999')).toBeUndefined();
  });

  it.each(['../admin', 'abc', '1%2F..', 'https:'])(
    'never calls upstream for an id that cannot exist (%s)',
    async (id) => {
      const fetchFn = vi.fn<typeof fetch>();
      expect(await source(fetchFn).adapter.getProduct(id)).toBeUndefined();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('maps and labels categories', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respond(['electronics', 'jewelery', "men's clothing"]));
    expect(await source(fetchFn).adapter.listCategories()).toEqual([
      { slug: 'electronics', name: 'Electronics' },
      { slug: 'jewelery', name: 'Jewellery' },
      { slug: 'mens-clothing', name: "Men's Clothing" },
    ]);
    expect(requestedUrl(fetchFn)).toBe('https://fakestoreapi.com/products/categories');
  });

  it('keeps any path prefix on the configured base URL', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respond([]));
    await source(fetchFn, { baseUrl: 'https://example.com/store/' }).adapter.listProducts();
    expect(requestedUrl(fetchFn)).toBe('https://example.com/store/products');
  });

  it('refuses redirects so a response can never send us to another host', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respond([]));
    await source(fetchFn).adapter.listProducts();
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
  });

  describe('failures map to UpstreamUnavailableError', () => {
    it.each([
      ['a 5xx response', () => Promise.resolve(respond('oops <html>', 503))],
      ['a 404 response', () => Promise.resolve(respond('', 404))],
      ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
      ['invalid JSON', () => Promise.resolve(respond('{not json'))],
      ['a non-list products body', () => Promise.resolve(respond({ products: [] }))],
    ])('%s', async (_label, behaviour) => {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(behaviour);
      await expect(source(fetchFn).adapter.listProducts()).rejects.toBeInstanceOf(
        UpstreamUnavailableError,
      );
    });

    it('a timeout', async () => {
      const hang: typeof fetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error));
        });
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(hang);
      await expect(
        source(fetchFn, { timeoutMs: 20 }).adapter.listProducts(),
      ).rejects.toBeInstanceOf(UpstreamUnavailableError);
    });

    it('never exposes the upstream body in the error', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respond('secret stack trace', 500));
      await expect(source(fetchFn).adapter.listProducts()).rejects.not.toThrow(/secret/);
    });
  });

  it('caps concurrent upstream requests', async () => {
    let active = 0;
    let peak = 0;
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return respond([]);
    });
    const { adapter } = source(fetchFn, { maxConcurrency: 2 });

    await Promise.all(Array.from({ length: 6 }, () => adapter.listProducts()));

    expect(fetchFn).toHaveBeenCalledTimes(6);
    expect(peak).toBe(2);
  });
});
