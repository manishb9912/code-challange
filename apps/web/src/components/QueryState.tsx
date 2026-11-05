import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import styles from './QueryState.module.css';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  const message =
    error instanceof ApiError ? error.message : 'An unexpected error occurred. Please try again.';
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <h2 className={styles.title}>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** Use 'h1' when the empty state is the whole page (e.g. 404). */
  headingLevel?: 'h1' | 'h2';
}

export function EmptyState({ title, children, headingLevel: Heading = 'h2' }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <Heading className={styles.title}>{title}</Heading>
      {children}
    </div>
  );
}
