import type { z } from 'zod';
import {
  CategoryListSchema,
  CategoryProductsSchema,
  EnquiryCreatedSchema,
  ErrorEnvelopeSchema,
  ProductListSchema,
  ProductPageSchema,
  ProductSchema,
  type EnquiryInput,
  type FieldError,
} from '@catalogue/shared';
import { API_BASE_URL } from '../config';

/** A failed API call, carrying the server's error envelope when there is one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

const NETWORK_ERROR_MESSAGE = 'We could not reach the server. Check your connection and try again.';

/**
 * The only place the web app calls fetch. Responses are validated against the shared
 * contract, so API drift fails loudly here instead of deep in a component.
 */
async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.output<T>> {
  let response: Response;
  try {
    // Resolved against the page so a relative base ('/api/v1') works the same everywhere.
    response = await fetch(new URL(`${API_BASE_URL}${path}`, window.location.href), {
      ...init,
      headers: { accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw toApiError(response.status, body);
  return schema.parse(body);
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope = ErrorEnvelopeSchema.safeParse(body);
  if (!envelope.success) return new ApiError(status, 'UNKNOWN', 'Something went wrong.');
  const { code, message, details } = envelope.data.error;
  return new ApiError(status, code, message, details);
}

const segment = encodeURIComponent;

export const api = {
  getFeaturedProducts: () => request('/products/featured', ProductListSchema),

  getCategories: () => request('/categories', CategoryListSchema),

  getCategoryProducts: (slug: string) =>
    request(`/categories/${segment(slug)}/products`, CategoryProductsSchema),

  searchProducts: (term: string) =>
    request(`/products?${new URLSearchParams({ q: term }).toString()}`, ProductPageSchema),

  getProduct: (id: string) => request(`/products/${segment(id)}`, ProductSchema),

  createEnquiry: (enquiry: EnquiryInput) =>
    request('/enquiries', EnquiryCreatedSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(enquiry),
    }),
};
