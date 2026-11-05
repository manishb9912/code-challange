import type { Category, Product } from '@catalogue/shared';

/**
 * Where products come from. Implementations translate their own data shape into our domain
 * model and throw UpstreamUnavailableError when the source cannot be used.
 */
export interface ProductSource {
  listProducts(): Promise<Product[]>;
  /** Resolves undefined when the product does not exist. */
  getProduct(id: string): Promise<Product | undefined>;
  listCategories(): Promise<Category[]>;
}
