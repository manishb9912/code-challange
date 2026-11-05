import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../../test/catalogue-data.js';
import { searchProducts, tokenize } from './search.js';

const ids = (term: string) => searchProducts(CATALOGUE, term).map((product) => product.id);

describe('searchProducts', () => {
  it('only returns products with text matching the term', () => {
    expect(ids('monitor')).toEqual(expect.arrayContaining(['12', '13', '31']));
    expect(ids('monitor')).toHaveLength(3);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(ids('  MONITOR ')).toEqual(ids('monitor'));
  });

  it('requires every token to match', () => {
    expect(ids('samsung monitor')).toEqual(['13']);
    expect(ids('samsung jacket')).toEqual([]);
  });

  it('searches title, description and category name', () => {
    expect(ids('Lovelace')).toEqual([]);
    expect(ids('PS4')).toEqual(['11']); // description
    expect(ids('jewellery')).toEqual(['20']); // category display name
  });

  it('ranks title matches before description-only matches', () => {
    // "monitor" is in the titles of 12 and 13, but only in the description of 31.
    expect(ids('monitor').at(-1)).toBe('31');
  });

  it.each(['.*', '+', '?', '(', 'C++', '*everything*', '[a-z]', '\\'])(
    'treats %j literally (no RegExp from user input)',
    (term) => {
      expect(() => searchProducts(CATALOGUE, term)).not.toThrow();
    },
  );

  it('matches special characters as plain text', () => {
    expect(ids('C++')).toEqual(['14']);
    expect(ids('.*')).toEqual([]);
  });

  it('returns nothing for a blank term', () => {
    expect(ids('   ')).toEqual([]);
  });
});

describe('tokenize', () => {
  it('splits on any whitespace and lower-cases', () => {
    expect(tokenize(' Red\tShirt \n XL ')).toEqual(['red', 'shirt', 'xl']);
  });
});
