import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import type { App } from '../types.js';

/**
 * OpenAPI generated from the same zod schemas that validate requests.
 * Swagger UI needs inline assets, so it ships its own hash-based CSP (staticCSP) on its
 * routes only; everything else keeps the strict API CSP. Gated by API_DOCS_ENABLED.
 */
export async function registerDocs(app: App): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: { title: 'Product Catalogue API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    staticCSP: true,
    uiConfig: { docExpansion: 'list' },
  });
}
