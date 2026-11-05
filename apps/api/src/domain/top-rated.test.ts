import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../../test/catalogue-data.js';
import { paginate } from './pagination.js';
import { splitByTopRated, topRatedByAverage } from './top-rated.js';

const electronics = CATALOGUE.filter((product) => product.category.slug === 'electronics');

describe('topRatedByAverage', () => {
  it('picks the top 3 by average rating, breaking ties on review count', () => {
    expect(topRatedByAverage()(electronics).map((p) => p.id)).toEqual(['11', '10', '12']);
  });

  it('returns everything when a category has fewer products than the limit', () => {
    expect(topRatedByAverage()(electronics.slice(0, 2))).toHaveLength(2);
  });

  it('does not mutate its input', () => {
    const before = electronics.map((p) => p.id);
    topRatedByAverage()(electronics);
    expect(electronics.map((p) => p.id)).toEqual(before);
  });
});

describe('splitByTopRated', () => {
  it('returns the rest of the category, excluding top rated, sorted by title', () => {
    const { topRated, others } = splitByTopRated(electronics, topRatedByAverage());
    expect(topRated.map((p) => p.id)).toEqual(['11', '10', '12']);
    expect(others.map((p) => p.title)).toEqual(['Basic USB Cable', 'Samsung 49-Inch Monitor']);
  });

  it('accepts any strategy (e.g. future curation)', () => {
    const curated = splitByTopRated(electronics, (products) =>
      products.filter((p) => p.id === '14'),
    );
    expect(curated.topRated.map((p) => p.id)).toEqual(['14']);
    expect(curated.others).toHaveLength(4);
  });
});

describe('paginate', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('slices a page and reports the total', () => {
    expect(paginate(items, { limit: 2, offset: 2 })).toEqual({
      items: ['c', 'd'],
      total: 5,
      limit: 2,
      offset: 2,
    });
  });

  it('returns an empty page past the end', () => {
    expect(paginate(items, { limit: 2, offset: 10 }).items).toEqual([]);
  });
});
