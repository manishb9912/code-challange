import type { App } from '../types.js';

export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

/** Default-deny caching: only routes that opt in (catalogue reads) are cacheable. */
export function registerCacheControl(app: App): void {
  app.addHook('onSend', async (_req, reply, payload) => {
    if (reply.statusCode >= 400 || !reply.hasHeader('cache-control')) {
      reply.header('cache-control', 'no-store');
    }
    return payload;
  });
}
