import { vi, type Mock } from 'vitest';
import type { Product } from '@catalogue/shared';
import type { Logger } from '../src/ports/logger.js';

/** A trimmed copy of real Fake Store responses (shape verified against the live API). */
export const fakeStoreProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops ',
  price: 109.95,
  description: 'Your perfect pack for everyday use and walks in the forest.',
  category: "men's clothing",
  image: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg',
  rating: { rate: 3.9, count: 120 },
  ...overrides,
});

interface SpyLogger {
  info: Mock<Logger['info']>;
  warn: Mock<Logger['warn']>;
  error: Mock<Logger['error']>;
}

/** Logger whose methods are spies (plain properties, so they can be asserted on directly). */
export const silentLogger = (): SpyLogger => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

let sequence = 0;

/** Domain product builder for service/route tests. */
export function product(overrides: Partial<Product> & { id: string }): Product {
  sequence += 1;
  return {
    title: `Product ${sequence}`,
    description: 'A product',
    price: { amount: 10, currency: 'USD' },
    category: { slug: 'electronics', name: 'Electronics' },
    imageUrl: 'https://fakestoreapi.com/img/example.jpg',
    rating: { average: 3, count: 10 },
    ...overrides,
  };
}
