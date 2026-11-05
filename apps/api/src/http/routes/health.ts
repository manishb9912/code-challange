import { z } from 'zod';
import { UpstreamUnavailableError } from '../../domain/errors.js';
import type { App } from '../types.js';

interface HealthDependencies {
  isReady: () => Promise<boolean>;
}

/** Ops probes. Not rate-limited: load balancers call them frequently from few IPs. */
export function healthRoutes(app: App, { isReady }: HealthDependencies): void {
  // Liveness: the process is up and serving. Deliberately checks no dependencies.
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['ops'],
        summary: 'Liveness probe',
        response: { 200: z.object({ status: z.literal('ok') }) },
      },
    },
    async () => ({ status: 'ok' as const }),
  );

  // Readiness: config loaded (or we would not be running) and products can be served.
  app.get(
    '/ready',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['ops'],
        summary: 'Readiness probe',
        response: { 200: z.object({ status: z.literal('ready') }) },
      },
    },
    async () => {
      if (!(await isReady())) throw new UpstreamUnavailableError('readiness check failed');
      return { status: 'ready' as const };
    },
  );
}
