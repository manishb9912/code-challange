import type { Product } from '@catalogue/shared';
import styles from './Rating.module.css';

interface RatingProps {
  rating: Product['rating'];
}

/** Text-first rating: the stars are decorative; screen readers get the full sentence. */
export function Rating({ rating }: RatingProps) {
  const label = `Rated ${rating.average.toFixed(1)} out of 5 from ${rating.count} reviews`;
  return (
    <p className={styles.rating}>
      <span className={styles.stars} aria-hidden="true">
        ★
      </span>
      <span className="visually-hidden">{label}</span>
      <span aria-hidden="true">
        {rating.average.toFixed(1)} <span className={styles.count}>({rating.count})</span>
      </span>
    </p>
  );
}
