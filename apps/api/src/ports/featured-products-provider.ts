/**
 * The entrepreneur's chosen "top rated" products for the home page, in display order.
 * Config-backed today; an admin UI / CMS-backed implementation can replace it later.
 */
export interface FeaturedProductsProvider {
  getFeaturedProductIds(): Promise<string[]>;
}
