import { z } from 'zod';

/**
 * Identifiers (product ids, category slugs) are deliberately boring: a short, anchored,
 * allowlisted character set. This blocks path traversal / SSRF into the upstream URL and
 * keeps the regex linear-time (no ReDoS).
 */
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const ProductIdSchema = z.string().regex(IDENTIFIER_PATTERN, 'Invalid product id');
export const CategorySlugSchema = z.string().regex(IDENTIFIER_PATTERN, 'Invalid category slug');
