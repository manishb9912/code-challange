import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { createQueryClient } from './api/queries';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/theme.css';
import './styles/global.css';

// zod's JIT probes `new Function`, which our CSP (no 'unsafe-eval') reports as a violation.
z.config({ jitless: true });

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
