import type { Category } from '@catalogue/shared';

/** Display names where Fake Store's raw value is not what customers should see. */
const CATEGORY_LABELS: Record<string, string> = {
  jewelery: 'Jewellery',
  "men's clothing": "Men's Clothing",
  "women's clothing": "Women's Clothing",
  electronics: 'Electronics',
};

/** "men's clothing" -> "mens-clothing": URL-safe and matches the identifier pattern. */
export function toCategorySlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Unknown categories fall back to Title Case so a new upstream category still displays. */
export function toCategoryName(raw: string): string {
  return CATEGORY_LABELS[raw] ?? raw.replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase());
}

export function toCategory(raw: string): Category {
  return { slug: toCategorySlug(raw), name: toCategoryName(raw) };
}
