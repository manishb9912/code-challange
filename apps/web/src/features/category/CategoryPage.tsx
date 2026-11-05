import { useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useCategoryProducts } from '../../api/queries';
import { ProductGrid } from '../../components/ProductGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import NotFoundPage from '../not-found/NotFoundPage';
import styles from '../../styles/page.module.css';

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useCategoryProducts(slug);

  if (isPending) return <LoadingState label="Loading category…" />;
  if (isError) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) {
      return <NotFoundPage title="Category not found" />;
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const { category, topRated, others } = data;

  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Category</p>
        <h1 className={styles.title}>{category.name}</h1>
      </header>

      <section className={styles.section} aria-labelledby="top-rated-heading">
        <h2 id="top-rated-heading" className={styles.sectionTitle}>
          Top rated
        </h2>
        {topRated.length > 0 ? (
          <ProductGrid products={topRated} label={`Top rated in ${category.name}`} />
        ) : (
          <EmptyState title="No products in this category yet" />
        )}
      </section>

      {others.items.length > 0 && (
        <section className={styles.section} aria-labelledby="more-heading">
          <h2 id="more-heading" className={styles.sectionTitle}>
            More in {category.name}
          </h2>
          <ProductGrid products={others.items} label={`More in ${category.name}`} />
        </section>
      )}
    </>
  );
}
