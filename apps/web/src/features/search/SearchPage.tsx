import { useSearchParams } from 'react-router-dom';
import { useSearch } from '../../api/queries';
import { ProductGrid } from '../../components/ProductGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import styles from '../../styles/page.module.css';

export default function SearchPage() {
  const [params] = useSearchParams();
  const term = (params.get('q') ?? '').trim();
  const { data, isPending, isError, error, refetch } = useSearch(term);

  if (!term) {
    return (
      <EmptyState title="Search the catalogue">
        <p>Enter a product name, description or category in the search bar above.</p>
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="search-heading">
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Search</p>
        <h1 id="search-heading" className={styles.title}>
          Results for “{term}”
        </h1>
        {data && (
          <p className={styles.lede} aria-live="polite">
            {data.total === 1 ? '1 product' : `${data.total} products`}
          </p>
        )}
      </header>

      {isPending && <LoadingState label="Searching…" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data?.items.length === 0 && (
        <EmptyState title={`No products match “${term}”`}>
          <p>Try a different or shorter search term.</p>
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <ProductGrid products={data.items} label="Search results" />
      )}
    </section>
  );
}
