import { Suspense } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { LoadingState } from '../components/QueryState';
import { STORE_NAME } from '../config';
import { CategoryNav } from './CategoryNav';
import { SearchForm } from './SearchForm';
import styles from './Layout.module.css';

const COPYRIGHT_YEAR = new Date().getFullYear();

export function Layout() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const currentTerm = pathname === '/search' ? (params.get('q') ?? '') : '';

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            {STORE_NAME}
          </Link>
          {/* Keyed on the URL term so the input resets when the search changes (back/forward). */}
          <SearchForm key={currentTerm} initialTerm={currentTerm} />
        </div>
        <div className={styles.navRow}>
          <CategoryNav />
        </div>
      </header>
      <main id="main" className={styles.main}>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className={styles.footer}>
        <p>
          © {COPYRIGHT_YEAR} {STORE_NAME}. Product data is a demo catalogue.
        </p>
      </footer>
    </div>
  );
}
