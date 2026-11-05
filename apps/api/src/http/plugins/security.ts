import helmet from '@fastify/helmet';
import { ForbiddenOriginError, UnsupportedMediaTypeError, UriTooLongError } from '../errors.js';
import type { App } from '../types.js';

/** Kept identical to the web app's nginx CSP (apps/web/nginx.conf). */
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  imgSrc: ["'self'", 'https://fakestoreapi.com', 'data:'],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
};

export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';
const MAX_URL_LENGTH = 2048;
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface SecurityOptions {
  allowedOrigins: string[];
  isProduction: boolean;
}

export async function registerSecurity(app: App, options: SecurityOptions): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
    // HSTS only when served behind TLS; on plain-HTTP localhost it would be meaningless.
    hsts: options.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  const allowedOrigins = new Set(options.allowedOrigins);

  app.addHook('onRequest', async (req, reply) => {
    reply.header('permissions-policy', PERMISSIONS_POLICY);

    if (req.url.length > MAX_URL_LENGTH) {
      throw new UriTooLongError('Request URL is too long');
    }
    if (!STATE_CHANGING_METHODS.has(req.method)) return;

    // CSRF defence in depth (the API has no cookies, so there is no ambient credential to abuse).
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      throw new ForbiddenOriginError('Origin not allowed');
    }
    // Cross-site HTML forms can only send "simple" content types; requiring JSON blocks them.
    if (!isJsonContentType(req.headers['content-type'])) {
      throw new UnsupportedMediaTypeError('Content-Type must be application/json');
    }
  });
}

function isJsonContentType(header: string | undefined): boolean {
  const mediaType = header?.split(';')[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}
