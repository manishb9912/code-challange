import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Enquiry, Product } from '@catalogue/shared';
import { ApiError } from '../../api/client';
import { useProduct } from '../../api/queries';
import { ErrorState, LoadingState } from '../../components/QueryState';
import NotFoundPage from '../not-found/NotFoundPage';
import pageStyles from '../../styles/page.module.css';
import { EnquiryForm } from './EnquiryForm';
import styles from './EnquiryPage.module.css';

export default function EnquiryPage() {
  const { id = '' } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);
  const [sent, setSent] = useState<Enquiry | null>(null);

  if (isPending) return <LoadingState label="Loading product…" />;
  if (isError) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) {
      return <NotFoundPage title="Product not found" />;
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className={styles.page}>
      <Link to={`/product/${encodeURIComponent(product.id)}`} className={pageStyles.backLink}>
        ← Back to {product.title}
      </Link>
      {sent ? (
        <ThankYou product={product} enquiry={sent} />
      ) : (
        <>
          <header className={pageStyles.pageHeader}>
            <p className={pageStyles.eyebrow}>Enquiry</p>
            <h1 className={pageStyles.title}>Ask about {product.title}</h1>
            <p className={pageStyles.lede}>
              Leave your details and our sales team will get back to you.
            </p>
          </header>
          <EnquiryForm product={product} onSent={setSent} />
        </>
      )}
    </div>
  );
}

function ThankYou({ product, enquiry }: { product: Product; enquiry: Enquiry }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Move focus to the confirmation so screen-reader and keyboard users hear the outcome.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className={styles.thankYou} aria-labelledby="thank-you-heading">
      <h1 id="thank-you-heading" ref={headingRef} tabIndex={-1} className={pageStyles.title}>
        Thank you
      </h1>
      <p>
        Thanks, {enquiry.name}. We have received your enquiry about <strong>{product.title}</strong>{' '}
        and will reply to {enquiry.email} soon.
      </p>
      <Link to={`/product/${encodeURIComponent(product.id)}`} className={styles.submit}>
        Back to {product.title}
      </Link>
    </section>
  );
}
