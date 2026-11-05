import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 24;
export const MAX_PAGE_LIMIT = 100;
/** Caps absurd offsets; far beyond any realistic catalogue browsing depth. */
export const MAX_PAGE_OFFSET = 10_000;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_PAGE_OFFSET).default(0),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  });

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
