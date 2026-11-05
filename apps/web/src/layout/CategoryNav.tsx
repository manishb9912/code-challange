import { NavLink } from 'react-router-dom';
import { useCategories } from '../api/queries';
import styles from './CategoryNav.module.css';

export function CategoryNav() {
  const { data: categories, isError } = useCategories();

  if (isError) {
    return <p className={styles.unavailable}>Categories are unavailable right now.</p>;
  }

  return (
    <nav aria-label="Categories">
      <ul className={styles.list}>
        {categories?.map((category) => (
          <li key={category.slug}>
            <NavLink
              to={`/category/${encodeURIComponent(category.slug)}`}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {category.name}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
