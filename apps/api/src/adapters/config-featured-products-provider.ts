import type { FeaturedProductsProvider } from '../ports/featured-products-provider.js';

/** Featured ids from configuration (FEATURED_PRODUCT_IDS), injected by the composition root. */
export class ConfigFeaturedProductsProvider implements FeaturedProductsProvider {
  constructor(private readonly ids: readonly string[]) {}

  async getFeaturedProductIds(): Promise<string[]> {
    return [...this.ids];
  }
}
