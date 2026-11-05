import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { featured, product } from '../../../test/data';
import { renderApp } from '../../../test/render';
import { API, errorResponse, server } from '../../../test/server';

const backpack = featured[0] ?? product({ id: '1', title: 'Backpack' });

describe('Product page', () => {
  it('WHEN I click a product tile THEN I see the product details page', async () => {
    server.use(http.get(API('/products/1'), () => HttpResponse.json(backpack)));
    const { user } = renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Featured products' });
    await user.click(within(grid).getByRole('link', { name: /Backpack/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Backpack' })).toBeInTheDocument();
    const details = within(screen.getByRole('article'));
    expect(details.getByText('$19.99')).toBeInTheDocument();
    expect(details.getByText('A lovely product.')).toBeInTheDocument();
    expect(details.getByRole('link', { name: 'Electronics' })).toHaveAttribute(
      'href',
      '/category/electronics',
    );
    expect(details.getByRole('link', { name: 'Enquire' })).toHaveAttribute(
      'href',
      '/product/1/enquire',
    );
  });

  it('renders a malicious upstream description as literal text, never as HTML', async () => {
    const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    server.use(
      http.get(API('/products/66'), () =>
        HttpResponse.json(product({ id: '66', title: 'Suspicious', description: payload })),
      ),
    );
    const { container } = renderApp('/product/66');

    expect(await screen.findByText(payload)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('shows "Product not found" for an unknown id', async () => {
    server.use(
      http.get(API('/products/999'), () => errorResponse(404, 'NOT_FOUND', 'Product not found')),
    );
    renderApp('/product/999');
    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
  });

  it('shows an error with retry when the product cannot be loaded', async () => {
    server.use(
      http.get(API('/products/1'), () =>
        errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'Products are temporarily unavailable.'),
      ),
    );
    renderApp('/product/1');
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
  });
});
