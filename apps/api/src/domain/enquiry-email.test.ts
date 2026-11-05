import { describe, expect, it } from 'vitest';
import { product } from '../../test/fixtures.js';
import { buildEnquiryEmail, toHeaderSafe } from './enquiry-email.js';
import { escapeHtml } from './escape-html.js';

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Ada Lovelace, 10 Downing St')).toBe('Ada Lovelace, 10 Downing St');
  });
});

describe('toHeaderSafe', () => {
  it('removes CR/LF so nothing can be injected into email headers', () => {
    expect(toHeaderSafe('Hello\r\nBcc: victim@example.com')).toBe('Hello Bcc: victim@example.com');
  });

  it('truncates long values', () => {
    expect(toHeaderSafe('a'.repeat(500))).toHaveLength(150);
  });
});

describe('buildEnquiryEmail', () => {
  const email = () =>
    buildEnquiryEmail({
      enquiryId: 'ref-1',
      salesInbox: 'sales@example.com',
      from: 'catalogue@example.com',
      product: product({
        id: '7',
        title: 'White Gold Ring\r\nBcc: x@example.com',
        price: { amount: 9.99, currency: 'USD' },
      }),
      enquiry: {
        productId: '7',
        name: '<img src=x onerror=alert(1)>',
        email: 'ada@example.com',
        message: 'Line one\n<b>bold?</b>',
      },
    });

  it('addresses the sales inbox and sets Reply-To to the customer', () => {
    expect(email().to).toEqual({ address: 'sales@example.com' });
    expect(email().replyTo.address).toBe('ada@example.com');
  });

  it('HTML-escapes customer input in the HTML part', () => {
    const { html } = email();
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;bold?&lt;/b&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
  });

  it('always includes a plain-text part', () => {
    expect(email().text).toContain('Message:\nLine one\n<b>bold?</b>');
  });

  it('strips CR/LF from the subject even if the product title contains them', () => {
    expect(email().subject).toBe('Product enquiry: White Gold Ring Bcc: x@example.com');
    expect(email().subject).not.toMatch(/[\r\n]/);
  });

  it('shows the price formatted in the product currency', () => {
    expect(email().text).toContain('Price: $9.99');
  });
});
