import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { CategoryProducts } from '@catalogue/shared';
import { product } from '../../../test/data';
import { renderApp } from '../../../test/render';
import { API, errorResponse, server } from '../../../test/server';

const jewellery = { slug: 'jewelery', name: 'Jewellery' };

const jewelleryProducts: CategoryProducts = {
  category: jewellery,
  topRated: [
    product({ id: '5', title: 'Dragon Bracelet', category: jewellery }),
    product({ id: '6', title: 'Solid Gold Petite', category: jewellery }),
    product({ id: '7', title: 'White Gold Ring', category: jewellery }),
  ],
  others: {
    items: [product({ id: '8', title: 'Rose Gold Earrings', category: jewellery })],
    total: 1,
    limit: 24,
    offset: 0,
  },
};

const titlesIn = (list: HTMLElement) =>
  within(list)
    .getAllByRole('heading')
    .map((heading) => heading.textContent);

describe('Category page', () => {
  it('WHEN I click a category link THEN I see top rated products AND additional products in that category', async () => {
    server.use(
      http.get(API('/categories/jewelery/products'), () => HttpResponse.json(jewelleryProducts)),
    );
    const { user } = renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    await user.click(await within(nav).findByRole('link', { name: 'Jewellery' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jewellery' })).toBeInTheDocument();
    expect(titlesIn(screen.getByRole('list', { name: 'Top rated in Jewellery' }))).toEqual([
      'Dragon Bracelet',
      'Solid Gold Petite',
      'White Gold Ring',
    ]);
    expect(titlesIn(screen.getByRole('list', { name: 'More in Jewellery' }))).toEqual([
      'Rose Gold Earrings',
    ]);
  });

  it('hides the additional section when the category has only top rated products', async () => {
    server.use(
      http.get(API('/categories/jewelery/products'), () =>
        HttpResponse.json({
          ...jewelleryProducts,
          others: { ...jewelleryProducts.others, items: [], total: 0 },
        }),
      ),
    );
    renderApp('/category/jewelery');

    expect(await screen.findByRole('list', { name: 'Top rated in Jewellery' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'More in Jewellery' })).not.toBeInTheDocument();
  });

  it('shows "Category not found" for an unknown category', async () => {
    server.use(
      http.get(API('/categories/garden/products'), () =>
        errorResponse(404, 'NOT_FOUND', 'Category not found'),
      ),
    );
    renderApp('/category/garden');
    expect(await screen.findByRole('heading', { name: 'Category not found' })).toBeInTheDocument();
  });

  it('shows an error with retry when products are unavailable', async () => {
    server.use(
      http.get(API('/categories/jewelery/products'), () =>
        errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'Products are temporarily unavailable.'),
      ),
    );
    renderApp('/category/jewelery');
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
