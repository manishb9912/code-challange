import { z } from 'zod';
import { pageSchema } from './pagination.js';
import { CategorySchema, ProductSchema } from './product.js';

export const ProductListSchema = z.array(ProductSchema);
export const CategoryListSchema = z.array(CategorySchema);
export const ProductPageSchema = pageSchema(ProductSchema);

export const CategoryProductsSchema = z.object({
  category: CategorySchema,
  topRated: z.array(ProductSchema),
  others: ProductPageSchema,
});

export type CategoryProducts = z.infer<typeof CategoryProductsSchema>;
