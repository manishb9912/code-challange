import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { App } from '../src/http/types.js';
import { ALLOWED_ORIGIN, buildTestApp, captureLogs, jsonHeaders } from './helpers.js';

/**
 * Transport-level controls exercised through the real app with throwaway probe routes, so
 * they are tested independently of any business endpoint.
 */
let app: App;

async function appWithProbeRoutes(env: Record<string, string> = {}, logStream = captureLogs()) {
  ({ app } = await buildTestApp({ env: { LOG_LEVEL: 'info', ...env }, logStream }));
  app.post(
    '/api/v1/probe',
    { schema: { body: z.strictObject({ text: z.string().max(20_000) }) } },
    async () => ({ ok: true }),
  );
  app.get('/api/v1/probe/boom', async () => {
    throw new Error('db password=hunter2 at /srv/app/secret.ts');
  });
  app.get('/api/v1/probe/log-pii', async (req) => {
    req.log.info(
      { enquiry: { name: 'Ada Lovelace', email: 'ada@example.com', phone: '0123' } },
      'x',
    );
    return { ok: true };
  });
  await app.ready();
  return app;
}

afterEach(async () => {
  await app.close();
});

describe('security headers', () => {
  it('sets CSP, nosniff, frame protection, referrer and permissions policies', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('only sends HSTS in production', async () => {
    await appWithProbeRoutes();
    expect(
      (await app.inject('/api/v1/health')).headers['strict-transport-security'],
    ).toBeUndefined();
    await app.close();

    await appWithProbeRoutes({ NODE_ENV: 'production', SMTP_SECURE: 'true' });
    expect((await app.inject('/api/v1/health')).headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});

describe('CSRF defence in depth on state-changing routes', () => {
  it('rejects a disallowed Origin with 403', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: { ...jsonHeaders, origin: 'https://evil.example' },
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'FORBIDDEN_ORIGIN' } });
  });

  it('rejects a missing Origin with 403', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: { 'content-type': 'application/json' },
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(403);
  });

  it.each(['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data; boundary=x'])(
    'rejects a %s body with 415',
    async (contentType) => {
      await appWithProbeRoutes();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/probe',
        headers: { origin: ALLOWED_ORIGIN, 'content-type': contentType },
        payload: 'text=hi',
      });
      expect(res.statusCode).toBe(415);
      expect(res.json()).toMatchObject({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
    },
  );

  it('accepts same-origin JSON', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: { ...jsonHeaders, 'content-type': 'application/json; charset=utf-8' },
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('resource limits', () => {
  it('rejects bodies over 10 KB with 413', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: jsonHeaders,
      payload: { text: 'a'.repeat(11 * 1024) },
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('rejects over-long URLs with 414', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({ method: 'GET', url: `/api/v1/health?pad=${'a'.repeat(3000)}` });
    expect(res.statusCode).toBe(414);
  });

  it('rejects prototype-poisoning JSON with 400', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: jsonHeaders,
      payload: '{"text":"hi","__proto__":{"admin":true}}',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 429 with Retry-After and RateLimit headers once the global limit is hit', async () => {
    await appWithProbeRoutes({ RATE_LIMIT_GLOBAL_PER_MINUTE: '2' });
    await app.inject('/api/v1/probe/log-pii');
    await app.inject('/api/v1/probe/log-pii');
    const res = await app.inject('/api/v1/probe/log-pii');

    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.headers['ratelimit-limit']).toBe('2');
    expect(res.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('does not rate-limit the health probe', async () => {
    await appWithProbeRoutes({ RATE_LIMIT_GLOBAL_PER_MINUTE: '1' });
    await app.inject('/api/v1/health');
    expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
  });
});

describe('error responses', () => {
  it('never leak stack traces or internal messages', async () => {
    await appWithProbeRoutes();
    const res = await app.inject('/api/v1/probe/boom');
    const { requestId, ...error } = res.json<{ error: Record<string, unknown> }>().error;

    expect(res.statusCode).toBe(500);
    expect(error).toEqual({
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again later.',
    });
    expect(requestId).toBe(res.headers['x-request-id']);
    expect(res.body).not.toMatch(/hunter2|secret\.ts|at \//);
  });

  it('uses the error envelope for unknown routes', async () => {
    await appWithProbeRoutes();
    const res = await app.inject('/api/v1/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: res.headers['x-request-id'],
      },
    });
  });
});

describe('request ids', () => {
  it('echoes a safe proxy-supplied X-Request-Id', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({ url: '/api/v1/health', headers: { 'x-request-id': 'abc-123' } });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('replaces an unsafe X-Request-Id instead of logging it', async () => {
    await appWithProbeRoutes();
    const res = await app.inject({
      url: '/api/v1/health',
      headers: { 'x-request-id': 'evil\u001b[31m injected' },
    });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('logging', () => {
  it('redacts customer PII even if code logs it by mistake', async () => {
    const logs = captureLogs();
    await appWithProbeRoutes({}, logs);
    await app.inject('/api/v1/probe/log-pii');

    expect(logs.text()).toContain('[REDACTED]');
    expect(logs.text()).not.toMatch(/ada@example\.com|Ada Lovelace|0123/);
  });
});
