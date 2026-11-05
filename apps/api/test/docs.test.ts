import { afterEach, describe, expect, it } from 'vitest';
import type { App } from '../src/http/types.js';
import { buildTestApp } from './helpers.js';

let app: App;

afterEach(async () => {
  await app.close();
});

describe('OpenAPI docs', () => {
  it('are generated from the zod schemas when enabled', async () => {
    ({ app } = await buildTestApp({ env: { API_DOCS_ENABLED: 'true' } }));
    const res = await app.inject('/api/v1/docs/json');
    const spec = res.json<{ paths: Record<string, unknown> }>();

    expect(res.statusCode).toBe(200);
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/products',
        '/api/v1/products/{id}',
        '/api/v1/categories/{slug}/products',
      ]),
    );
  });

  it('are not served when disabled (the default)', async () => {
    ({ app } = await buildTestApp());
    expect((await app.inject('/api/v1/docs/json')).statusCode).toBe(404);
  });
});
