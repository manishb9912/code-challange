import { z } from 'zod';

/**
 * Fake Store's wire format. Never trusted: every response is validated here, and these
 * shapes never leave adapters/fakestore/.
 */
export const FakeStoreProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  price: z.number().nonnegative(),
  description: z.string().max(10_000),
  category: z.string().min(1).max(100),
  image: z.string().max(2048),
  rating: z.object({
    rate: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
});

export const FakeStoreCategoriesSchema = z.array(z.string().min(1).max(100));

export type FakeStoreProduct = z.infer<typeof FakeStoreProductSchema>;
