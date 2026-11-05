import { z } from 'zod';
import { IDENTIFIER_PATTERN } from '@catalogue/shared';

const booleanFromEnv = z
  .enum(['true', 'false'], { error: 'must be "true" or "false"' })
  .transform((value) => value === 'true');

const commaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const originList = z
  .string()
  .transform(commaList)
  .pipe(
    z
      .array(
        z.url().refine((value) => new URL(value).origin === value, {
          message: 'each origin must be scheme://host[:port] with no path or trailing slash',
        }),
      )
      .min(1, 'at least one origin is required'),
  );

const productIdList = z
  .string()
  .transform(commaList)
  .pipe(z.array(z.string().regex(IDENTIFIER_PATTERN, 'each id must match [A-Za-z0-9_-]{1,64}')));

const hostList = z
  .string()
  .transform(commaList)
  .pipe(z.array(z.string().regex(/^[a-z0-9.-]{1,253}$/, 'each entry must be a bare hostname')));

/** Raw environment contract. Every variable here is documented in .env.example and the README. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Number of trusted proxy hops in front of the API (0 = trust none). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    ALLOWED_ORIGINS: originList,
    API_DOCS_ENABLED: booleanFromEnv.default(false),

    FAKESTORE_BASE_URL: z.url().default('https://fakestoreapi.com'),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5000),
    UPSTREAM_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    IMAGE_HOST_ALLOWLIST: hostList.default(['fakestoreapi.com']),
    CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(86_400).default(300),
    FEATURED_PRODUCT_IDS: productIdList.default([]),

    RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().min(1).default(100),
    RATE_LIMIT_ENQUIRY_PER_MINUTE: z.coerce.number().int().min(1).default(5),

    SALES_INBOX: z.email(),
    MAIL_FROM: z.email(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    /** true = implicit TLS (port 465). */
    SMTP_SECURE: booleanFromEnv.default(false),
    /** true = refuse to send unless STARTTLS succeeds. */
    SMTP_REQUIRE_TLS: booleanFromEnv.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (new URL(env.FAKESTORE_BASE_URL).protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        path: ['FAKESTORE_BASE_URL'],
        message: 'must use https:// in production',
      });
    }
    if (!env.SMTP_SECURE && !env.SMTP_REQUIRE_TLS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_SECURE'],
        message: 'SMTP must use TLS in production (set SMTP_SECURE or SMTP_REQUIRE_TLS to true)',
      });
    }
  });

export type Env = z.output<typeof EnvSchema>;
