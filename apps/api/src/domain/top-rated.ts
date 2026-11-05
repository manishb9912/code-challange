import type { Product } from '@catalogue/shared';

/**
 * Chooses a category's "top rated" products. A function type so a curated strategy (e.g.
 * entrepreneur-picked per category) can replace the derived one without touching callers.
 */
export type TopRatedStrategy = (categoryProducts: readonly Product[]) => Product[];

export const TOP_RATED_PER_CATEGORY = 3;

/** Highest average rating first; more reviews wins a tie (a 4.5 from 300 beats a 4.5 from 2). */
export function compareByRating(a: Product, b: Product): number {
  return b.rating.average - a.rating.average || b.rating.count - a.rating.count;
}

export const topRatedByAverage =
  (limit = TOP_RATED_PER_CATEGORY): TopRatedStrategy =>
  (categoryProducts) =>
    [...categoryProducts].sort(compareByRating).slice(0, limit);

/** Splits a category into its top-rated products and the rest (deduplicated, by title). */
export function splitByTopRated(
  categoryProducts: readonly Product[],
  strategy: TopRatedStrategy,
): { topRated: Product[]; others: Product[] } {
  const topRated = strategy(categoryProducts);
  const topIds = new Set(topRated.map((product) => product.id));
  const others = categoryProducts
    .filter((product) => !topIds.has(product.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));
  return { topRated, others };
}
