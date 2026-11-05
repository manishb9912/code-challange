import { describe, expect, it } from 'vitest';
import { EnquirySchema } from './enquiry.js';

const valid = {
  productId: '1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
};

const parse = (overrides: Record<string, unknown>) =>
  EnquirySchema.safeParse({ ...valid, ...overrides });

describe('EnquirySchema', () => {
  it('accepts the minimum contact details (name + email)', () => {
    expect(EnquirySchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional phone and message', () => {
    expect(parse({ phone: '+44 (0)20 7946-0000', message: 'Do you ship to Leeds?' }).success).toBe(
      true,
    );
  });

  it('trims the name and normalises the email to lower case', () => {
    const result = EnquirySchema.parse({ ...valid, name: '  Ada  ', email: ' Ada@Example.COM ' });
    expect(result.name).toBe('Ada');
    expect(result.email).toBe('ada@example.com');
  });

  it.each([
    ['missing name', { name: undefined }],
    ['blank name', { name: '   ' }],
    ['over-long name', { name: 'a'.repeat(101) }],
    ['invalid email', { email: 'not-an-email' }],
    ['over-long email', { email: `${'a'.repeat(250)}@example.com` }],
    ['phone with letters', { phone: '0800-CALL-NOW' }],
    ['over-long phone', { phone: '1'.repeat(31) }],
    ['over-long message', { message: 'a'.repeat(2001) }],
    ['bad product id', { productId: '../../etc/passwd' }],
  ])('rejects %s', (_label, overrides) => {
    expect(parse(overrides).success).toBe(false);
  });

  describe('header injection', () => {
    it.each([
      ['CR/LF in name', { name: 'Ada\r\nBcc: victim@example.com' }],
      ['LF in name', { name: 'Ada\nBcc: victim@example.com' }],
      ['CR/LF in email', { email: 'ada@example.com\r\nBcc: victim@example.com' }],
    ])('rejects %s', (_label, overrides) => {
      expect(parse(overrides).success).toBe(false);
    });
  });

  it('keeps newlines in the message but strips other control characters', () => {
    const result = EnquirySchema.parse({ ...valid, message: 'Hi\u0000 there\r\nThanks\u0007' });
    expect(result.message).toBe('Hi there\nThanks');
  });

  describe('strictness / prototype pollution', () => {
    it('rejects unknown keys', () => {
      expect(parse({ price: 0.01 }).success).toBe(false);
    });

    it.each(['__proto__', 'constructor'])('rejects a JSON body containing %s', (key) => {
      const body: unknown = JSON.parse(
        `{"productId":"1","name":"Ada","email":"ada@example.com","${key}":{"polluted":true}}`,
      );
      expect(EnquirySchema.safeParse(body).success).toBe(false);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  it('accepts a filled honeypot so the API can silently drop it', () => {
    expect(parse({ website: 'http://spam.example' }).success).toBe(true);
  });
});
