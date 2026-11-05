import Fastify, { LogController } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { CachedProductSource } from './adapters/cached-product-source.js';
import { ConfigFeaturedProductsProvider } from './adapters/config-featured-products-provider.js';
import { FakeStoreProductSource } from './adapters/fakestore/fakestore-product-source.js';
import { MemoryCache } from './adapters/memory-cache/memory-cache.js';
import { SmtpMailer } from './adapters/smtp/smtp-mailer.js';
import type { AppConfig } from './config/index.js';
import { topRatedByAverage } from './domain/top-rated.js';
import { loggerOptions, type LogStream } from './http/logging.js';
import { registerCacheControl } from './http/plugins/cache-control.js';
import { registerDocs } from './http/plugins/docs.js';
import { registerErrorHandler } from './http/plugins/error-handler.js';
import { registerRateLimit } from './http/plugins/rate-limit.js';
import { generateRequestId, registerRequestId } from './http/plugins/request-id.js';
import { registerSecurity } from './http/plugins/security.js';
import { catalogueRoutes } from './http/routes/catalogue.js';
import { enquiryRoutes } from './http/routes/enquiries.js';
import { healthRoutes } from './http/routes/health.js';
import type { App } from './http/types.js';
import type { Cache } from './ports/cache.js';
import type { FeaturedProductsProvider } from './ports/featured-products-provider.js';
import type { Logger } from './ports/logger.js';
import type { Mailer } from './ports/mailer.js';
import type { ProductSource } from './ports/product-source.js';
import { CatalogueService } from './services/catalogue-service.js';
import { EnquiryService } from './services/enquiry-service.js';

export const API_PREFIX = '/api/v1';
const BODY_LIMIT_BYTES = 10 * 1024;

/** Swappable infrastructure. Anything not supplied is built from config. */
export interface Adapters {
  /** The underlying product data; caching is always layered on top. */
  productSource: ProductSource;
  cache: Cache;
  featured: FeaturedProductsProvider;
  mailer: Mailer;
}

export interface BuildAppOptions {
  config: AppConfig;
  adapters?: Partial<Adapters>;
  /** Capture logs (tests). Defaults to stdout. */
  logStream?: LogStream;
}

/** Composition root: the only place that knows which concrete adapters are in use. */
export async function buildApp({
  config,
  adapters = {},
  logStream,
}: BuildAppOptions): Promise<App> {
  const app = Fastify({
    logger: loggerOptions(config.logLevel, logStream),
    genReqId: generateRequestId,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    // Trust X-Forwarded-* only from the configured number of proxy hops (0 = none).
    trustProxy: (_address: string, hop: number) => hop < config.trustProxyHops,
    bodyLimit: BODY_LIMIT_BYTES,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    keepAliveTimeout: 5_000,
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
    routerOptions: { maxParamLength: 100 },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const source = createProductSource(config, adapters, app.log);
  const mailer = adapters.mailer ?? new SmtpMailer(config.mail.smtp);
  app.addHook('onClose', () => mailer.close());

  const catalogue = new CatalogueService({
    source,
    featured: adapters.featured ?? new ConfigFeaturedProductsProvider(config.featuredProductIds),
    topRated: topRatedByAverage(),
    logger: app.log,
  });
  const enquiries = new EnquiryService({
    source,
    mailer,
    salesInbox: config.mail.salesInbox,
    from: config.mail.from,
    logger: app.log,
  });

  registerRequestId(app);
  registerErrorHandler(app);
  registerCacheControl(app);
  await registerSecurity(app, {
    allowedOrigins: config.allowedOrigins,
    isProduction: config.isProduction,
  });
  await registerRateLimit(app, config.rateLimit.globalPerMinute);
  if (config.apiDocsEnabled) await registerDocs(app);

  await app.register(
    async (api) => {
      healthRoutes(api, { isReady: () => catalogue.isReady() });
      await catalogueRoutes(api, catalogue);
      enquiryRoutes(api, enquiries, config.rateLimit.enquiryPerMinute);
    },
    { prefix: API_PREFIX },
  );

  return app;
}

function createProductSource(
  config: AppConfig,
  adapters: Partial<Adapters>,
  logger: Logger,
): ProductSource {
  const source =
    adapters.productSource ??
    new FakeStoreProductSource({
      baseUrl: config.upstream.baseUrl,
      timeoutMs: config.upstream.timeoutMs,
      maxConcurrency: config.upstream.maxConcurrency,
      imageHostAllowlist: config.upstream.imageHostAllowlist,
      logger,
    });
  return new CachedProductSource(source, adapters.cache ?? new MemoryCache(), {
    ttlMs: config.cacheTtlSeconds * 1000,
    logger,
  });
}
