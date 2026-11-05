import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ErrorCode } from '@catalogue/shared';
import { categories, featured } from './data';

/** Mock API at the network boundary: components and the real API client run unchanged. */
export const API = (path: string) => `/api/v1${path}`;

export const server = setupServer(
  http.get(API('/categories'), () => HttpResponse.json(categories)),
  http.get(API('/products/featured'), () => HttpResponse.json(featured)),
);

export function errorResponse(status: number, code: ErrorCode, message: string) {
  return HttpResponse.json({ error: { code, message, requestId: 'test-request' } }, { status });
}
