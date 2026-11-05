import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../../test/render';
import { API, errorResponse, server } from '../../../test/server';

describe('Home page', () => {
  it('GIVEN 5 chosen products WHEN I view the home page THEN I see those 5 featured products', async () => {
    renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Featured products' });
    const tiles = within(grid).getAllByRole('listitem');

    expect(tiles).toHaveLength(5);
    expect(tiles.map((tile) => within(tile).getByRole('heading').textContent)).toEqual([
      'Backpack',
      'Dragon Bracelet',
      'Portable Hard Drive',
      'Curved Monitor',
      'Rain Jacket',
    ]);
  });

  it('shows each tile with image, title, price and rating', async () => {
    renderApp('/');
    const tile = (await screen.findAllByRole('article'))[0];
    if (!tile) throw new Error('no tiles rendered');

    expect(within(tile).getByRole('img', { name: 'Backpack' })).toHaveAttribute('loading', 'lazy');
    expect(within(tile).getByText('$19.99')).toBeInTheDocument();
    expect(within(tile).getByText('Rated 4.2 out of 5 from 120 reviews')).toBeInTheDocument();
  });

  it('shows the category links in the header', async () => {
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    expect(await within(nav).findByRole('link', { name: 'Jewellery' })).toHaveAttribute(
      'href',
      '/category/jewelery',
    );
  });

  it('shows an error with a retry when the API fails', async () => {
    server.use(
      http.get(API('/products/featured'), () =>
        errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'Products are temporarily unavailable.'),
      ),
    );
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Products are temporarily unavailable.',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows a 404 page for unknown routes', async () => {
    renderApp('/definitely/not/here');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
