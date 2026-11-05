import type { Category, Product } from '@catalogue/shared';

export const categories: Category[] = [
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'jewelery', name: 'Jewellery' },
];

let sequence = 0;

export function product(overrides: Partial<Product> & { id: string }): Product {
  sequence += 1;
  return {
    title: `Product ${sequence}`,
    description: 'A lovely product.',
    price: { amount: 19.99, currency: 'USD' },
    category: categories[0] ?? { slug: 'electronics', name: 'Electronics' },
    imageUrl: 'https://fakestoreapi.com/img/example.jpg',
    rating: { average: 4.2, count: 120 },
    ...overrides,
  };
}

export const featured: Product[] = [
  product({ id: '1', title: 'Backpack' }),
  product({ id: '5', title: 'Dragon Bracelet' }),
  product({ id: '9', title: 'Portable Hard Drive' }),
  product({ id: '14', title: 'Curved Monitor' }),
  product({ id: '18', title: 'Rain Jacket' }),
];
