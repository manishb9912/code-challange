import { afterEach, describe, expect, it } from 'vitest';
import type { ErrorEnvelope } from '@catalogue/shared';
import type { App } from '../src/http/types.js';
import { buildTestApp, captureLogs, jsonHeaders } from './helpers.js';
import type { SpyMailer } from './spy-mailer.js';

let app: App;
let mailer: SpyMailer;

const validEnquiry = {
  productId: '12',
  name: 'Ada Lovelace',
  email: 'Ada@Example.com',
  phone: '+44 20 7946 0000',
  message: 'Is this available in black?',
};

async function start(env: Record<string, string> = {}, logStream = captureLogs()) {
  ({ app, mailer } = await buildTestApp({ env, logStream }));
}

const post = (payload: unknown, headers: Record<string, string> = jsonHeaders) =>
  app.inject({ method: 'POST', url: '/api/v1/enquiries', headers, payload: payload as object });

afterEach(async () => {
  await app.close();
});

describe('POST /api/v1/enquiries', () => {
  it('GIVEN a product and contact details WHEN submitted THEN the sales inbox receives an email', async () => {
    await start();
    const res = await post(validEnquiry);

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: expect.any(String) as string });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toEqual({ address: 'sales@example.com' });
  });

  it('uses product data looked up on the server, not anything the client sent', async () => {
    await start();
    await post(validEnquiry);
    const email = mailer.sent[0];

    expect(email?.subject).toBe('Product enquiry: Acer 21.5 inch Monitor');
    expect(email?.text).toContain('Product: Acer 21.5 inch Monitor (id 12)');
    expect(email?.text).toContain('Price: $10.00');
  });

  it('rejects client-supplied product details (unknown keys)', async () => {
    await start();
    const res = await post({ ...validEnquiry, productTitle: 'Free TV', price: 0 });
    expect(res.statusCode).toBe(400);
    expect(mailer.sent).toHaveLength(0);
  });

  it('sets Reply-To to the customer so sales can answer directly', async () => {
    await start();
    await post(validEnquiry);
    expect(mailer.sent[0]?.replyTo).toEqual({ name: 'Ada Lovelace', address: 'ada@example.com' });
  });

  it('HTML-escapes customer input in the email', async () => {
    await start();
    await post({
      ...validEnquiry,
      name: '<script>alert(1)</script>',
      message: '<img src=x onerror=alert(1)>',
    });
    const html = mailer.sent[0]?.html ?? '';

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toMatch(/<script|<img/);
  });

  it('returns 400 with field errors for invalid contact details', async () => {
    await start();
    const res = await post({ productId: '12', name: '', email: 'nope' });
    const { error } = res.json<ErrorEnvelope>();

    expect(res.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((detail) => detail.path)).toEqual(
      expect.arrayContaining(['name', 'email']),
    );
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects CR/LF header injection in the name', async () => {
    await start();
    const res = await post({ ...validEnquiry, name: 'Ada\r\nBcc: victim@example.com' });
    expect(res.statusCode).toBe(400);
    expect(mailer.sent).toHaveLength(0);
  });

  it('returns 400 for a product that does not exist', async () => {
    await start();
    const res = await post({ ...validEnquiry, productId: '999' });
    expect(res.statusCode).toBe(400);
    expect(res.json<ErrorEnvelope>().error.details).toEqual([
      { path: 'productId', message: 'Unknown product' },
    ]);
  });

  it('returns 502 (never a false "thank you") when the email cannot be sent', async () => {
    await start();
    mailer.failWith = new Error('ECONNREFUSED 127.0.0.1:1025');
    const res = await post(validEnquiry);
    const { error } = res.json<ErrorEnvelope>();

    expect(res.statusCode).toBe(502);
    expect(error.code).toBe('MAIL_DELIVERY_FAILED');
    expect(res.body).not.toContain('ECONNREFUSED');
  });

  it('silently drops honeypot submissions: 201 for the bot, nothing sent', async () => {
    const logs = captureLogs();
    await start({ LOG_LEVEL: 'info' }, logs);
    const res = await post({ ...validEnquiry, website: 'https://spam.example' });

    expect(res.statusCode).toBe(201);
    expect(mailer.sent).toHaveLength(0);
    expect(logs.text()).toContain('honeypot_triggered');
    expect(logs.text()).not.toContain('ada@example.com');
  });

  it('never writes the customer details to the logs', async () => {
    const logs = captureLogs();
    await start({ LOG_LEVEL: 'trace' }, logs);
    await post(validEnquiry);
    mailer.failWith = new Error('smtp down');
    await post(validEnquiry);

    expect(logs.text()).toContain('enquiry sent');
    expect(logs.text()).toContain('enquiry email failed');
    expect(logs.text()).not.toMatch(/ada@example\.com|Ada Lovelace|7946|available in black/i);
  });

  describe('abuse protection', () => {
    it('returns 429 with Retry-After on the 6th enquiry within a minute', async () => {
      await start();
      for (let i = 0; i < 5; i += 1) expect((await post(validEnquiry)).statusCode).toBe(201);

      const res = await post(validEnquiry);
      expect(res.statusCode).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
      expect(res.json<ErrorEnvelope>().error.code).toBe('RATE_LIMITED');
      expect(mailer.sent).toHaveLength(5);
    });

    it('applies the strict enquiry limit instead of the global one', async () => {
      await start({ RATE_LIMIT_GLOBAL_PER_MINUTE: '50', RATE_LIMIT_ENQUIRY_PER_MINUTE: '2' });
      await post(validEnquiry);
      await post(validEnquiry);
      expect((await post(validEnquiry)).statusCode).toBe(429);
      expect((await app.inject('/api/v1/categories')).statusCode).toBe(200);
    });

    it('rejects a cross-origin POST with 403', async () => {
      await start();
      const res = await post(validEnquiry, { ...jsonHeaders, origin: 'https://evil.example' });
      expect(res.statusCode).toBe(403);
      expect(mailer.sent).toHaveLength(0);
    });

    it('rejects a non-JSON (HTML form) POST with 415', async () => {
      await start();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/enquiries',
        headers: { ...jsonHeaders, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'productId=12&name=Ada&email=ada%40example.com',
      });
      expect(res.statusCode).toBe(415);
      expect(mailer.sent).toHaveLength(0);
    });
  });

  it('closes the mailer on shutdown', async () => {
    await start();
    await app.close();
    expect(mailer.closed).toBe(true);
  });
});
