import { z } from 'zod';
import { CategorySlugSchema, ProductIdSchema } from './ids.js';

/** Our domain model, intentionally independent of any upstream (e.g. Fake Store) shape. */
export const CategorySchema = z.object({
  slug: CategorySlugSchema,
  name: z.string(),
});

export const ProductSchema = z.object({
  id: ProductIdSchema,
  title: z.string(),
  description: z.string(),
  price: z.object({
    amount: z.number().nonnegative(),
    currency: z.literal('USD'),
  }),
  category: CategorySchema,
  /** Absolute https URL on an allowlisted host, or a same-origin placeholder path. */
  imageUrl: z.string(),
  rating: z.object({
    average: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
});

export type Category = z.infer<typeof CategorySchema>;
export type Product = z.infer<typeof ProductSchema>;
