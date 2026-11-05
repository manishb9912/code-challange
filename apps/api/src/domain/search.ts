import type { Product } from '@catalogue/shared';

/** Lower-cased, whitespace-separated tokens of a search term. */
export function tokenize(term: string): string[] {
  return term.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * A product matches only if EVERY token appears in its title, description or category name.
 * Matching uses plain `includes`, never a RegExp built from user input, so special characters
 * are literal and there is no ReDoS risk. Products matching more tokens in the title rank
 * first; otherwise the source order is kept (stable sort).
 */
export function searchProducts(products: readonly Product[], term: string): Product[] {
  const tokens = tokenize(term);
  if (tokens.length === 0) return [];

  return products
    .map((product) => ({ product, ...matchScore(product, tokens) }))
    .filter((candidate) => candidate.matches)
    .sort((a, b) => b.titleHits - a.titleHits)
    .map((candidate) => candidate.product);
}

function matchScore(product: Product, tokens: string[]) {
  const title = product.title.toLowerCase();
  const haystack = `${title}\n${product.description.toLowerCase()}\n${product.category.name.toLowerCase()}`;
  return {
    matches: tokens.every((token) => haystack.includes(token)),
    titleHits: tokens.filter((token) => title.includes(token)).length,
  };
}
