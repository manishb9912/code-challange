import { describe, expect, it } from 'vitest';
import { SearchQuerySchema } from './search.js';
import { PaginationQuerySchema } from './pagination.js';

describe('SearchQuerySchema', () => {
  it('trims the term and applies default pagination', () => {
    expect(SearchQuerySchema.parse({ q: '  shirt ' })).toEqual({
      q: 'shirt',
      limit: 24,
      offset: 0,
    });
  });

  it.each([
    ['missing', {}],
    ['blank', { q: '   ' }],
    ['over 100 characters', { q: 'a'.repeat(101) }],
  ])('rejects a %s term', (_label, query) => {
    expect(SearchQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('PaginationQuerySchema', () => {
  it('coerces query-string numbers', () => {
    expect(PaginationQuerySchema.parse({ limit: '10', offset: '20' })).toEqual({
      limit: 10,
      offset: 20,
    });
  });

  it.each([
    ['limit above the max', { limit: '101' }],
    ['zero limit', { limit: '0' }],
    ['negative offset', { offset: '-1' }],
    ['non-numeric limit', { limit: 'ten' }],
  ])('rejects %s', (_label, query) => {
    expect(PaginationQuerySchema.safeParse(query).success).toBe(false);
  });
});
