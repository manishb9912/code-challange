import type { Enquiry, Product } from '@catalogue/shared';
import type { OutgoingEmail } from './email.js';
import { escapeHtml } from './escape-html.js';

export interface EnquiryEmailInput {
  enquiryId: string;
  enquiry: Enquiry;
  /** Looked up server-side; client-sent product details are never trusted. */
  product: Product;
  salesInbox: string;
  from: string;
}

const MAX_SUBJECT_LENGTH = 150;

/** Header values must never contain CR/LF (header injection) or other control characters. */
export function toHeaderSafe(value: string, maxLength = MAX_SUBJECT_LENGTH): string {
  return value
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function formatPrice(product: Product): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: product.price.currency,
  }).format(product.price.amount);
}

/**
 * Builds the sales-inbox email. Every interpolated value is HTML-escaped in the HTML part,
 * and a plain-text part is always included.
 */
export function buildEnquiryEmail(input: EnquiryEmailInput): OutgoingEmail {
  const { enquiry, product } = input;
  const rows: [label: string, value: string][] = [
    ['Product', `${product.title} (id ${product.id})`],
    ['Price', formatPrice(product)],
    ['Category', product.category.name],
    ['Name', enquiry.name],
    ['Email', enquiry.email],
    ['Phone', enquiry.phone || 'Not provided'],
    ['Enquiry reference', input.enquiryId],
  ];
  const message = enquiry.message?.trim() || 'No message provided.';

  const text = [
    'New product enquiry',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    message,
    '',
    'Reply to this email to respond to the customer.',
  ].join('\n');

  const html = [
    '<h1>New product enquiry</h1>',
    '<table>',
    ...rows.map(
      ([label, value]) =>
        `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    ),
    '</table>',
    '<h2>Message</h2>',
    `<p style="white-space: pre-wrap">${escapeHtml(message)}</p>`,
    '<p>Reply to this email to respond to the customer.</p>',
  ].join('\n');

  return {
    to: { address: input.salesInbox },
    from: { name: 'Product Catalogue', address: input.from },
    // Address objects (not string concatenation) so the mail library encodes the name safely.
    replyTo: { name: toHeaderSafe(enquiry.name, 100), address: enquiry.email },
    subject: toHeaderSafe(`Product enquiry: ${product.title}`),
    text,
    html,
  };
}
