import { useFeaturedProducts } from '../../api/queries';
import { ProductGrid } from '../../components/ProductGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import styles from '../../styles/page.module.css';

export default function HomePage() {
  const { data: products, isPending, isError, error, refetch } = useFeaturedProducts();

  return (
    <section aria-labelledby="home-heading">
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Featured</p>
        <h1 id="home-heading" className={styles.title}>
          Top rated, hand-picked
        </h1>
        <p className={styles.lede}>A small selection of our favourite pieces this season.</p>
      </header>

      {isPending && <LoadingState label="Loading featured products…" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {products?.length === 0 && <EmptyState title="No featured products yet" />}
      {products && products.length > 0 && (
        <ProductGrid products={products} label="Featured products" />
      )}
    </section>
  );
}
