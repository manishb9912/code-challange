import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/QueryState';

interface NotFoundPageProps {
  title?: string;
}

export default function NotFoundPage({ title = 'Page not found' }: NotFoundPageProps) {
  return (
    <EmptyState title={title} headingLevel="h1">
      <p>The page you are looking for does not exist or has moved.</p>
      <Link to="/">Back to the home page</Link>
    </EmptyState>
  );
}
