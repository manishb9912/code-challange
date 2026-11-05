import { Link } from 'react-router-dom';
import type { Product } from '@catalogue/shared';
import { formatPrice } from '../lib/format';
import { Rating } from './Rating';
import styles from './ProductTile.module.css';

interface ProductTileProps {
  product: Product;
}

/** The one product card used on home, category and search pages. */
export function ProductTile({ product }: ProductTileProps) {
  return (
    <article className={styles.tile}>
      <Link to={`/product/${encodeURIComponent(product.id)}`} className={styles.link}>
        <div className={styles.media}>
          <img
            src={product.imageUrl}
            alt={product.title}
            width={240}
            height={240}
            loading="lazy"
            decoding="async"
            className={styles.image}
          />
        </div>
        <div className={styles.body}>
          <p className={styles.category}>{product.category.name}</p>
          <h3 className={styles.title}>{product.title}</h3>
          <div className={styles.meta}>
            <p className={styles.price}>{formatPrice(product.price)}</p>
            <Rating rating={product.rating} />
          </div>
        </div>
      </Link>
    </article>
  );
}
