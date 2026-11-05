import type { Product } from '@catalogue/shared';
import { ProductTile } from './ProductTile';
import styles from './ProductGrid.module.css';

interface ProductGridProps {
  products: Product[];
  label: string;
}

export function ProductGrid({ products, label }: ProductGridProps) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  );
}
