import { PLACEHOLDER_IMAGE_PATH, type Product } from '@catalogue/shared';
import { toCategory } from './category.js';
import type { FakeStoreProduct } from './schema.js';

/** Fake Store shape -> our domain model. */
export function toProduct(raw: FakeStoreProduct, imageHostAllowlist: readonly string[]): Product {
  return {
    id: String(raw.id),
    title: raw.title.trim(),
    description: raw.description.trim(),
    price: { amount: raw.price, currency: 'USD' },
    category: toCategory(raw.category),
    imageUrl: safeImageUrl(raw.image, imageHostAllowlist),
    rating: { average: raw.rating.rate, count: raw.rating.count },
  };
}

/**
 * Only https images from allowlisted hosts reach the browser (no mixed content, no
 * javascript:/data: URLs, matches the CSP img-src). Anything else becomes a placeholder.
 */
export function safeImageUrl(candidate: string, allowlist: readonly string[]): string {
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && allowlist.includes(url.hostname)
      ? url.href
      : PLACEHOLDER_IMAGE_PATH;
  } catch {
    return PLACEHOLDER_IMAGE_PATH;
  }
}
