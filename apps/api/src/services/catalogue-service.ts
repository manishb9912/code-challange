import type { Category, CategoryProducts, Page, PaginationQuery, Product } from '@catalogue/shared';
import { NotFoundError } from '../domain/errors.js';
import { paginate } from '../domain/pagination.js';
import { searchProducts } from '../domain/search.js';
import { splitByTopRated, type TopRatedStrategy } from '../domain/top-rated.js';
import type { FeaturedProductsProvider } from '../ports/featured-products-provider.js';
import type { Logger } from '../ports/logger.js';
import type { ProductSource } from '../ports/product-source.js';

/** The home page shows at most this many featured products. */
export const MAX_FEATURED_PRODUCTS = 5;

export interface CatalogueDependencies {
  source: ProductSource;
  featured: FeaturedProductsProvider;
  topRated: TopRatedStrategy;
  logger: Logger;
}

/**
 * Catalogue use cases. Depends only on ports and pure domain logic, so the data source can be
 * swapped (Fake Store today, a database tomorrow) without changing this class or the API.
 */
export class CatalogueService {
  constructor(private readonly deps: CatalogueDependencies) {}

  /**
   * The chosen featured products in the chosen order. Unknown ids are skipped with a warning
   * (a typo in config must not take the home page down), so fewer than 5 may be returned.
   */
  async getFeatured(): Promise<Product[]> {
    const ids = [...new Set(await this.deps.featured.getFeaturedProductIds())];
    const byId = new Map((await this.deps.source.listProducts()).map((p) => [p.id, p]));

    const featured: Product[] = [];
    for (const id of ids) {
      const product = byId.get(id);
      if (product) featured.push(product);
      else this.deps.logger.warn({ productId: id }, 'featured product not found; skipping');
    }
    return featured.slice(0, MAX_FEATURED_PRODUCTS);
  }

  listCategories(): Promise<Category[]> {
    return this.deps.source.listCategories();
  }

  async getCategoryProducts(slug: string, page: PaginationQuery): Promise<CategoryProducts> {
    const category = (await this.deps.source.listCategories()).find((c) => c.slug === slug);
    if (!category) throw new NotFoundError('Category');

    const products = await this.deps.source.listProducts();
    const inCategory = products.filter((p) => p.category.slug === slug);
    const { topRated, others } = splitByTopRated(inCategory, this.deps.topRated);
    return { category, topRated, others: paginate(others, page) };
  }

  async search(term: string, page: PaginationQuery): Promise<Page<Product>> {
    return paginate(searchProducts(await this.deps.source.listProducts(), term), page);
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.deps.source.getProduct(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  /** Ready when products can be served: the source answers, or the cache still holds data. */
  async isReady(): Promise<boolean> {
    try {
      await this.deps.source.listCategories();
      return true;
    } catch {
      return false;
    }
  }
}
