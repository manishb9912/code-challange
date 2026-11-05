import etag from '@fastify/etag';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  CategoryListSchema,
  CategoryProductsSchema,
  CategorySlugSchema,
  PaginationQuerySchema,
  ProductIdSchema,
  ProductListSchema,
  ProductPageSchema,
  ProductSchema,
  SearchQuerySchema,
} from '@catalogue/shared';
import type { CatalogueService } from '../../services/catalogue-service.js';
import { PUBLIC_CACHE_CONTROL } from '../plugins/cache-control.js';
import type { App } from '../types.js';

/** Catalogue reads are public and identical for everyone, so CDNs/browsers may cache them. */
function cacheable(reply: FastifyReply): void {
  reply.header('cache-control', PUBLIC_CACHE_CONTROL);
}

export async function catalogueRoutes(app: App, catalogue: CatalogueService): Promise<void> {
  // Scoped to these routes (fastify-plugin attaches it to this encapsulation context only).
  await app.register(etag);

  app.get(
    '/products/featured',
    {
      schema: {
        tags: ['catalogue'],
        summary: 'Featured products chosen for the home page (max 5, in chosen order)',
        response: { 200: ProductListSchema },
      },
    },
    async (_req, reply) => {
      const featured = await catalogue.getFeatured();
      cacheable(reply);
      return featured;
    },
  );

  app.get(
    '/categories',
    {
      schema: {
        tags: ['catalogue'],
        summary: 'List product categories',
        response: { 200: CategoryListSchema },
      },
    },
    async (_req, reply) => {
      cacheable(reply);
      return catalogue.listCategories();
    },
  );

  app.get(
    '/categories/:slug/products',
    {
      schema: {
        tags: ['catalogue'],
        summary: 'Top rated and other products in a category',
        params: z.object({ slug: CategorySlugSchema }),
        querystring: PaginationQuerySchema,
        response: { 200: CategoryProductsSchema },
      },
    },
    async (req, reply) => {
      const result = await catalogue.getCategoryProducts(req.params.slug, req.query);
      cacheable(reply);
      return result;
    },
  );

  app.get(
    '/products',
    {
      schema: {
        tags: ['catalogue'],
        summary: 'Search products (all terms must match title, description or category)',
        querystring: SearchQuerySchema,
        response: { 200: ProductPageSchema },
      },
    },
    async (req, reply) => {
      const { q, ...page } = req.query;
      const result = await catalogue.search(q, page);
      cacheable(reply);
      return result;
    },
  );

  app.get(
    '/products/:id',
    {
      schema: {
        tags: ['catalogue'],
        summary: 'Product details',
        params: z.object({ id: ProductIdSchema }),
        response: { 200: ProductSchema },
      },
    },
    async (req, reply) => {
      const product = await catalogue.getProduct(req.params.id);
      cacheable(reply);
      return product;
    },
  );
}
