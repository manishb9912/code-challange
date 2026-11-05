import type { FastifyServerOptions } from 'fastify';

/** Where log lines go; tests pass an in-memory stream to assert on output. */
export interface LogStream {
  write(line: string): void;
}

const PII_FIELDS = ['name', 'email', 'phone', 'message'] as const;
/** Containers in which request/enquiry data could plausibly be logged. */
const PII_CONTAINERS = ['enquiry', 'body', 'req.body'] as const;

/**
 * Defence in depth: application code never logs PII on purpose, but if someone does, these
 * paths are censored. Explicit paths (not `*.message`) so error messages stay readable.
 */
export const REDACT_PATHS = [
  ...PII_FIELDS,
  ...PII_CONTAINERS.flatMap((container) => PII_FIELDS.map((field) => `${container}.${field}`)),
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'SMTP_PASS',
  'smtp.pass',
  'config.mail.smtp.pass',
];

export function loggerOptions(level: string, stream?: LogStream): FastifyServerOptions['logger'] {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    ...(stream ? { stream } : {}),
  };
}
