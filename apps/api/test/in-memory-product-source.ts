import type { Category, Product } from '@catalogue/shared';
import { UpstreamUnavailableError } from '../src/domain/errors.js';
import type { ProductSource } from '../src/ports/product-source.js';

/** Test double for the product data source. `failing = true` simulates an upstream outage. */
export class InMemoryProductSource implements ProductSource {
  failing = false;
  calls = 0;

  constructor(private readonly products: Product[]) {}

  async listProducts(): Promise<Product[]> {
    this.guard();
    return this.products;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    this.guard();
    return this.products.find((product) => product.id === id);
  }

  async listCategories(): Promise<Category[]> {
    this.guard();
    const bySlug = new Map(
      this.products.map((product) => [product.category.slug, product.category]),
    );
    return [...bySlug.values()];
  }

  private guard(): void {
    this.calls += 1;
    if (this.failing) throw new UpstreamUnavailableError('simulated outage');
  }
}
