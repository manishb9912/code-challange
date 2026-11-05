import { z } from 'zod';
import { PaginationQuerySchema } from './pagination.js';

export const SEARCH_TERM_MAX_LENGTH = 100;

export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z
    .string({ error: 'Search term is required' })
    .trim()
    .min(1, 'Search term is required')
    .max(
      SEARCH_TERM_MAX_LENGTH,
      `Search term must be at most ${SEARCH_TERM_MAX_LENGTH} characters`,
    ),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
