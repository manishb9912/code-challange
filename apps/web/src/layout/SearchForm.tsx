import { useState, type FormEvent } from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';
import { SEARCH_TERM_MAX_LENGTH } from '@catalogue/shared';
import styles from './SearchForm.module.css';

interface SearchFormProps {
  initialTerm: string;
}

/**
 * Submits on the button or Enter. The term lives in the URL (/search?q=), so back, refresh
 * and sharing all work. Blank terms cannot be submitted.
 */
export function SearchForm({ initialTerm }: SearchFormProps) {
  const [term, setTerm] = useState(initialTerm);
  const navigate = useNavigate();
  const trimmed = term.trim();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return;
    void navigate({ pathname: '/search', search: createSearchParams({ q: trimmed }).toString() });
  };

  return (
    <form role="search" className={styles.form} onSubmit={onSubmit}>
      <label htmlFor="site-search" className="visually-hidden">
        Search products
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        className={styles.input}
        placeholder="Search products"
        value={term}
        maxLength={SEARCH_TERM_MAX_LENGTH}
        onChange={(event) => setTerm(event.target.value)}
        autoComplete="off"
      />
      <button type="submit" className={styles.button} disabled={!trimmed}>
        Search
      </button>
    </form>
  );
}
