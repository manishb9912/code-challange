import { buildApp, type Adapters } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config/index.js';
import type { LogStream } from '../src/http/logging.js';
import { CATALOGUE } from './catalogue-data.js';
import { InMemoryProductSource } from './in-memory-product-source.js';
import { SpyMailer } from './spy-mailer.js';

export const ALLOWED_ORIGIN = 'http://localhost:8080';

export const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  ALLOWED_ORIGINS: ALLOWED_ORIGIN,
  SALES_INBOX: 'sales@example.com',
  MAIL_FROM: 'catalogue@example.com',
  SMTP_HOST: 'localhost',
};

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({ ...BASE_ENV, ...overrides });
}

/** In-memory log sink so tests can assert on exactly what would be written. */
export function captureLogs(): LogStream & { lines: string[]; text: () => string } {
  const lines: string[] = [];
  return {
    lines,
    write: (line: string) => {
      lines.push(line);
    },
    text: () => lines.join(''),
  };
}

interface TestAppOptions {
  env?: Record<string, string>;
  adapters?: Partial<Adapters>;
  logStream?: LogStream;
}

/**
 * The real app wired with in-memory fakes: never touches the network (no Fake Store, no SMTP).
 */
export async function buildTestApp({ env = {}, adapters = {}, logStream }: TestAppOptions = {}) {
  const source = new InMemoryProductSource(CATALOGUE);
  const mailer = new SpyMailer();
  const app = await buildApp({
    config: testConfig(env),
    adapters: { productSource: source, mailer, ...adapters },
    ...(logStream ? { logStream } : {}),
  });
  return { app, source, mailer };
}

export const jsonHeaders = {
  'content-type': 'application/json',
  origin: ALLOWED_ORIGIN,
};
