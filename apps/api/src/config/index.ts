import { EnvSchema } from './env-schema.js';

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  host: string;
  port: number;
  logLevel: string;
  trustProxyHops: number;
  allowedOrigins: string[];
  apiDocsEnabled: boolean;
  upstream: {
    baseUrl: string;
    timeoutMs: number;
    maxConcurrency: number;
    imageHostAllowlist: string[];
  };
  cacheTtlSeconds: number;
  featuredProductIds: string[];
  rateLimit: {
    globalPerMinute: number;
    enquiryPerMinute: number;
  };
  mail: {
    salesInbox: string;
    from: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      requireTls: boolean;
      user?: string;
      pass?: string;
    };
  };
}

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

/**
 * Parses and validates configuration. Fails fast with variable names and reasons only:
 * input values are never echoed, so secrets cannot leak into startup logs.
 */
export function loadConfig(source: Record<string, string | undefined>): AppConfig {
  const result = EnvSchema.safeParse(withoutBlanks(source));
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  const env = result.data;
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    allowedOrigins: env.ALLOWED_ORIGINS,
    apiDocsEnabled: env.API_DOCS_ENABLED,
    upstream: {
      baseUrl: env.FAKESTORE_BASE_URL,
      timeoutMs: env.UPSTREAM_TIMEOUT_MS,
      maxConcurrency: env.UPSTREAM_MAX_CONCURRENCY,
      imageHostAllowlist: env.IMAGE_HOST_ALLOWLIST,
    },
    cacheTtlSeconds: env.CACHE_TTL_SECONDS,
    featuredProductIds: env.FEATURED_PRODUCT_IDS,
    rateLimit: {
      globalPerMinute: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
      enquiryPerMinute: env.RATE_LIMIT_ENQUIRY_PER_MINUTE,
    },
    mail: {
      salesInbox: env.SALES_INBOX,
      from: env.MAIL_FROM,
      smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        requireTls: env.SMTP_REQUIRE_TLS,
        ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
        ...(env.SMTP_PASS ? { pass: env.SMTP_PASS } : {}),
      },
    },
  };
}

/** The only place in the API that reads process.env. */
export function loadConfigFromProcess(): AppConfig {
  return loadConfig(process.env);
}

/** Treat `VAR=` (blank, as in .env.example) the same as unset so defaults apply. */
function withoutBlanks(source: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
}
