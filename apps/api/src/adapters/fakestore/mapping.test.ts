import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_IMAGE_PATH } from '@catalogue/shared';
import { fakeStoreProduct } from '../../../test/fixtures.js';
import { toCategory, toCategorySlug } from './category.js';
import { safeImageUrl, toProduct } from './mapper.js';
import { FakeStoreProductSchema } from './schema.js';

const ALLOWLIST = ['fakestoreapi.com'];

describe('category mapping', () => {
  it.each([
    ["men's clothing", 'mens-clothing'],
    ["women's clothing", 'womens-clothing'],
    ['jewelery', 'jewelery'],
    ['  Home & Garden ', 'home-garden'],
  ])('slugifies %j as %j', (raw, slug) => {
    expect(toCategorySlug(raw)).toBe(slug);
  });

  it('shows "Jewellery" for Fake Store\'s "jewelery"', () => {
    expect(toCategory('jewelery')).toEqual({ slug: 'jewelery', name: 'Jewellery' });
  });

  it('title-cases categories it has no label for', () => {
    expect(toCategory('home goods').name).toBe('Home Goods');
  });
});

describe('toProduct', () => {
  it('maps the Fake Store shape to our domain model', () => {
    const raw = FakeStoreProductSchema.parse(fakeStoreProduct());
    expect(toProduct(raw, ALLOWLIST)).toEqual({
      id: '1',
      title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
      description: 'Your perfect pack for everyday use and walks in the forest.',
      price: { amount: 109.95, currency: 'USD' },
      category: { slug: 'mens-clothing', name: "Men's Clothing" },
      imageUrl: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg',
      rating: { average: 3.9, count: 120 },
    });
  });
});

describe('upstream validation', () => {
  it.each([
    ['missing title', { title: undefined }],
    ['string price', { price: '109.95' }],
    ['negative price', { price: -1 }],
    ['rating out of range', { rating: { rate: 9, count: 1 } }],
    ['non-numeric id', { id: 'abc' }],
  ])('rejects a malformed item: %s', (_label, overrides) => {
    expect(FakeStoreProductSchema.safeParse(fakeStoreProduct(overrides)).success).toBe(false);
  });
});

describe('safeImageUrl', () => {
  it('keeps https images from an allowlisted host', () => {
    expect(safeImageUrl('https://fakestoreapi.com/img/a.png', ALLOWLIST)).toBe(
      'https://fakestoreapi.com/img/a.png',
    );
  });

  it.each([
    ['plain http (mixed content)', 'http://fakestoreapi.com/img/a.png'],
    ['a host that is not allowlisted', 'https://evil.example/a.png'],
    ['a look-alike host', 'https://fakestoreapi.com.evil.example/a.png'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:image/svg+xml,<svg onload=alert(1)>'],
    ['garbage', 'not a url'],
  ])('replaces %s with the placeholder', (_label, url) => {
    expect(safeImageUrl(url, ALLOWLIST)).toBe(PLACEHOLDER_IMAGE_PATH);
  });
});
