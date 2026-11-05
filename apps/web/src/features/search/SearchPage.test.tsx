import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Page, Product } from '@catalogue/shared';
import { product } from '../../../test/data';
import { renderApp } from '../../../test/render';
import { API, server } from '../../../test/server';

const page = (items: Product[]): Page<Product> => ({
  items,
  total: items.length,
  limit: 24,
  offset: 0,
});

/** Fake backend search: returns matches for "monitor", nothing otherwise; records the terms. */
function mockSearch() {
  const terms: string[] = [];
  server.use(
    http.get(API('/products'), ({ request }) => {
      const term = new URL(request.url).searchParams.get('q') ?? '';
      terms.push(term);
      return HttpResponse.json(
        term === 'monitor'
          ? page([
              product({ id: '13', title: 'Acer 21.5 inch Monitor' }),
              product({ id: '14', title: 'Samsung 49-Inch Monitor' }),
            ])
          : page([]),
      );
    }),
  );
  return terms;
}

describe('Search', () => {
  it('GIVEN a search term WHEN I click Search THEN I only see products matching that term', async () => {
    const terms = mockSearch();
    const { user } = renderApp('/');

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), '  monitor ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const results = await screen.findByRole('list', { name: 'Search results' });
    expect(
      within(results)
        .getAllByRole('heading')
        .map((h) => h.textContent),
    ).toEqual(['Acer 21.5 inch Monitor', 'Samsung 49-Inch Monitor']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “monitor”');
    expect(terms).toEqual(['monitor']);
  });

  it('submits with the Enter key too', async () => {
    mockSearch();
    const { user } = renderApp('/');
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'monitor{Enter}');
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
  });

  it('shows an explicit empty state when nothing matches', async () => {
    mockSearch();
    renderApp('/search?q=unicorn');
    expect(
      await screen.findByRole('heading', { name: 'No products match “unicorn”' }),
    ).toBeInTheDocument();
  });

  it('disables the Search button while the input is blank', async () => {
    const { user } = renderApp('/');
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toBeDisabled();

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), '   ');
    expect(button).toBeDisabled();
  });

  it('limits the search term to 100 characters', () => {
    renderApp('/');
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveAttribute(
      'maxLength',
      '100',
    );
  });

  it('keeps the term in the URL so refresh and sharing work', async () => {
    mockSearch();
    renderApp('/search?q=monitor');
    expect(await screen.findByRole('list', { name: 'Search results' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('monitor');
  });
});
