import rateLimit from '@fastify/rate-limit';
import { RateLimitedError } from '../errors.js';
import type { App } from '../types.js';

/**
 * Per-IP limits (the IP comes from req.ip, which honours trustProxy).
 * The default store is in-memory, so limits are per instance; production with several
 * instances passes a shared Redis store here (`redis` option) without other code changes.
 */
export async function registerRateLimit(app: App, globalPerMinute: number): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: globalPerMinute,
    timeWindow: '1 minute',
    enableDraftSpec: true,
    errorResponseBuilder: (_req, context) =>
      new RateLimitedError(`Too many requests. Please try again in ${context.after}.`),
  });
}
