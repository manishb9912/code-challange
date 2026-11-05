import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './index.js';
import { BASE_ENV } from '../../test/helpers.js';

const load = (overrides: Record<string, string | undefined>) =>
  loadConfig({ ...BASE_ENV, ...overrides });

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    const config = load({});
    expect(config.port).toBe(3000);
    expect(config.cacheTtlSeconds).toBe(300);
    expect(config.upstream.baseUrl).toBe('https://fakestoreapi.com');
    expect(config.upstream.timeoutMs).toBe(5000);
    expect(config.rateLimit).toEqual({ globalPerMinute: 100, enquiryPerMinute: 5 });
    expect(config.apiDocsEnabled).toBe(false);
  });

  it('treats blank values (as in .env.example) as unset', () => {
    expect(load({ SMTP_USER: '', SMTP_PASS: '', PORT: '' }).mail.smtp).not.toHaveProperty('user');
  });

  it('parses featured product ids in the chosen order', () => {
    expect(load({ FEATURED_PRODUCT_IDS: ' 9, 1 ,14,,5 ' }).featuredProductIds).toEqual([
      '9',
      '1',
      '14',
      '5',
    ]);
  });

  it('fails fast listing every missing required variable', () => {
    const env = Object.fromEntries(
      Object.entries(BASE_ENV).filter(([key]) => key !== 'SALES_INBOX' && key !== 'SMTP_HOST'),
    );
    expect(() => loadConfig(env)).toThrow(ConfigError);
    try {
      loadConfig(env);
    } catch (error) {
      expect((error as ConfigError).problems.join('\n')).toMatch(/SALES_INBOX[\s\S]*SMTP_HOST/);
    }
  });

  it('never echoes configuration values in errors (secrets stay out of logs)', () => {
    const secret = 'super-secret-password-123';
    expect(() => load({ SMTP_PASS: secret, SMTP_PORT: secret })).toThrow(ConfigError);
    try {
      load({ SMTP_PASS: secret, SMTP_PORT: secret });
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it.each([
    ['an origin with a path', { ALLOWED_ORIGINS: 'http://localhost:8080/app' }],
    ['a featured id with path characters', { FEATURED_PRODUCT_IDS: '1,../2' }],
    ['a non-boolean flag', { API_DOCS_ENABLED: 'yes' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => load(overrides)).toThrow(ConfigError);
  });

  describe('in production', () => {
    const prod = { NODE_ENV: 'production', SMTP_SECURE: 'true' };

    it('requires an https upstream', () => {
      expect(() => load({ ...prod, FAKESTORE_BASE_URL: 'http://fakestoreapi.com' })).toThrow(
        /https/,
      );
    });

    it('requires TLS for SMTP', () => {
      expect(() => load({ ...prod, SMTP_SECURE: 'false' })).toThrow(/TLS/);
      expect(load({ ...prod, SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'true' }).isProduction).toBe(
        true,
      );
    });
  });
});
