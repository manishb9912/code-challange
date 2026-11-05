import pLimit, { type LimitFunction } from 'p-limit';
import type { Category, Product } from '@catalogue/shared';
import { UpstreamUnavailableError } from '../../domain/errors.js';
import type { Logger } from '../../ports/logger.js';
import type { ProductSource } from '../../ports/product-source.js';
import { toCategory } from './category.js';
import { toProduct } from './mapper.js';
import { FakeStoreCategoriesSchema, FakeStoreProductSchema } from './schema.js';

export interface FakeStoreOptions {
  baseUrl: string;
  timeoutMs: number;
  maxConcurrency: number;
  imageHostAllowlist: readonly string[];
  logger: Logger;
  /** Injected so tests never touch the network. */
  fetchFn?: typeof fetch;
}

/** Fake Store only has numeric ids; anything else cannot exist, so skip the round trip. */
const FAKESTORE_ID = /^\d{1,10}$/;

export class FakeStoreProductSource implements ProductSource {
  private readonly baseUrl: URL;
  private readonly limit: LimitFunction;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: FakeStoreOptions) {
    this.baseUrl = new URL(options.baseUrl.replace(/\/+$/, '') + '/');
    this.limit = pLimit(options.maxConcurrency);
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async listProducts(): Promise<Product[]> {
    const body = await this.getJson('products');
    if (!Array.isArray(body)) throw new UpstreamUnavailableError('products response is not a list');

    const products: Product[] = [];
    body.forEach((item: unknown, index) => {
      const parsed = FakeStoreProductSchema.safeParse(item);
      if (parsed.success) {
        products.push(toProduct(parsed.data, this.options.imageHostAllowlist));
      } else {
        // Drop the bad item rather than fail the whole catalogue.
        this.options.logger.warn(
          { index, issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
          'dropped malformed upstream product',
        );
      }
    });
    return products;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    if (!FAKESTORE_ID.test(id)) return undefined;
    const body = await this.getJson(`products/${encodeURIComponent(id)}`);
    // Fake Store answers 200 with an empty body for unknown ids.
    if (body === null) return undefined;
    const parsed = FakeStoreProductSchema.safeParse(body);
    if (!parsed.success) throw new UpstreamUnavailableError('malformed product response');
    return toProduct(parsed.data, this.options.imageHostAllowlist);
  }

  async listCategories(): Promise<Category[]> {
    const parsed = FakeStoreCategoriesSchema.safeParse(await this.getJson('products/categories'));
    if (!parsed.success) throw new UpstreamUnavailableError('malformed categories response');
    return parsed.data.map(toCategory);
  }

  /** GET a path under the configured base URL. Returns null for an empty body. */
  private async getJson(path: string): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    // Defence in depth: callers encode ids, but a path may never escape the configured base.
    if (url.origin !== this.baseUrl.origin || !url.pathname.startsWith(this.baseUrl.pathname)) {
      throw new UpstreamUnavailableError('refused to call a URL outside the configured base');
    }

    const response = await this.limit(() =>
      this.fetchFn(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
        redirect: 'error',
      }),
    ).catch((error: unknown) => {
      throw new UpstreamUnavailableError('request failed', { cause: error });
    });

    if (!response.ok) {
      // The upstream body is deliberately not read or propagated.
      throw new UpstreamUnavailableError(`unexpected status ${response.status}`);
    }

    const text = await response.text().catch((error: unknown) => {
      throw new UpstreamUnavailableError('failed reading response', { cause: error });
    });
    if (text.trim() === '') return null;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new UpstreamUnavailableError('invalid JSON', { cause: error });
    }
  }
}
