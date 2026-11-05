import { Component, type ReactNode } from 'react';
import { ErrorState } from './QueryState';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence for render errors (including a failed lazy chunk load): shows a
 * friendly message instead of a blank page. Data-fetch errors are handled per page.
 * Production would add componentDidCatch to report to client monitoring (e.g. CloudWatch RUM).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return <ErrorState error={this.state.error} onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
