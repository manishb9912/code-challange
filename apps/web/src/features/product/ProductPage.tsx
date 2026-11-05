import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useProduct } from '../../api/queries';
import { ErrorState, LoadingState } from '../../components/QueryState';
import { Rating } from '../../components/Rating';
import { formatPrice } from '../../lib/format';
import NotFoundPage from '../not-found/NotFoundPage';
import styles from './ProductPage.module.css';

export default function ProductPage() {
  const { id = '' } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);

  if (isPending) return <LoadingState label="Loading product…" />;
  if (isError) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) {
      return <NotFoundPage title="Product not found" />;
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <article className={styles.product}>
      <div className={styles.media}>
        <img
          src={product.imageUrl}
          alt={product.title}
          width={480}
          height={480}
          className={styles.image}
        />
      </div>
      <div className={styles.details}>
        <Link
          to={`/category/${encodeURIComponent(product.category.slug)}`}
          className={styles.category}
        >
          {product.category.name}
        </Link>
        <h1 className={styles.title}>{product.title}</h1>
        <div className={styles.meta}>
          <p className={styles.price}>{formatPrice(product.price)}</p>
          <Rating rating={product.rating} />
        </div>
        {/* Upstream text is rendered as text only (React escapes it); never as HTML. */}
        <p className={styles.description}>{product.description}</p>
        <Link to={`/product/${encodeURIComponent(product.id)}/enquire`} className={styles.enquire}>
          Enquire
        </Link>
      </div>
    </article>
  );
}
