import { useMutation, useQuery, QueryClient } from '@tanstack/react-query';
import type { EnquiryInput } from '@catalogue/shared';
import { api, ApiError } from './client';

/** Retry transient failures (network, 5xx) once; never retry client errors like 404 or 429. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const transient = !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
  return transient && failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}

export const queryKeys = {
  featured: ['products', 'featured'] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['categories', slug, 'products'] as const,
  search: (term: string) => ['products', 'search', term] as const,
  product: (id: string) => ['products', id] as const,
};

export const useFeaturedProducts = () =>
  useQuery({ queryKey: queryKeys.featured, queryFn: api.getFeaturedProducts });

export const useCategories = () =>
  useQuery({ queryKey: queryKeys.categories, queryFn: api.getCategories, staleTime: 5 * 60_000 });

export const useCategoryProducts = (slug: string) =>
  useQuery({ queryKey: queryKeys.category(slug), queryFn: () => api.getCategoryProducts(slug) });

export const useSearch = (term: string) =>
  useQuery({
    queryKey: queryKeys.search(term),
    queryFn: () => api.searchProducts(term),
    enabled: term.trim().length > 0,
  });

export const useProduct = (id: string) =>
  useQuery({ queryKey: queryKeys.product(id), queryFn: () => api.getProduct(id) });

export const useCreateEnquiry = () =>
  useMutation({ mutationFn: (enquiry: EnquiryInput) => api.createEnquiry(enquiry) });
