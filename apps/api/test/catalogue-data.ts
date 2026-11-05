import type { Product } from '@catalogue/shared';
import { product } from './fixtures.js';

const electronics = { slug: 'electronics', name: 'Electronics' };
const jewellery = { slug: 'jewelery', name: 'Jewellery' };
const mens = { slug: 'mens-clothing', name: "Men's Clothing" };

/**
 * Small catalogue with deliberate rating ties so the top-rated tie-break is exercised.
 * Electronics by rating: e1 (4.8/500), e2 (4.8/20), e3 (4.5), e4 (3.0), e5 (2.0).
 */
export const CATALOGUE: Product[] = [
  product({
    id: '10',
    title: 'SanDisk SSD PLUS 1TB',
    description: 'Fast solid state drive',
    category: electronics,
    rating: { average: 4.8, count: 20 },
  }),
  product({
    id: '11',
    title: 'WD 4TB Gaming Drive',
    description: 'Expand your PS4 gaming experience',
    category: electronics,
    rating: { average: 4.8, count: 500 },
  }),
  product({
    id: '12',
    title: 'Acer 21.5 inch Monitor',
    description: 'Full HD widescreen IPS display',
    category: electronics,
    rating: { average: 4.5, count: 250 },
  }),
  product({
    id: '13',
    title: 'Samsung 49-Inch Monitor',
    description: 'Super ultrawide screen QLED',
    category: electronics,
    rating: { average: 3.0, count: 140 },
  }),
  product({
    id: '14',
    title: 'Basic USB Cable',
    description: 'A cable (C++ compatible?) for *everything*.',
    category: electronics,
    rating: { average: 2.0, count: 5 },
  }),
  product({
    id: '20',
    title: 'Solid Gold Petite Micropave',
    description: 'Satisfaction guaranteed',
    category: jewellery,
    rating: { average: 3.9, count: 70 },
  }),
  product({
    id: '30',
    title: 'Mens Cotton Jacket',
    description: 'Great outerwear for spring, autumn and winter',
    category: mens,
    rating: { average: 4.7, count: 500 },
  }),
  product({
    id: '31',
    title: 'Slim Fit T-Shirt',
    description: 'Lightweight cotton tee with a monitor print',
    category: mens,
    rating: { average: 4.1, count: 259 },
  }),
];
