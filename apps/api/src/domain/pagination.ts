import type { Page, PaginationQuery } from '@catalogue/shared';

/** In-memory slice of a fully loaded list (fine for ~20 items; a DB adapter would page in SQL). */
export function paginate<T>(items: readonly T[], { limit, offset }: PaginationQuery): Page<T> {
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}
