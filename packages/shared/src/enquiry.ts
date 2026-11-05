import { z } from 'zod';
import { ProductIdSchema } from './ids.js';

export const ENQUIRY_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  message: 2000,
} as const;

/** Any C0/C1 control character (includes CR, LF, NUL, TAB). */
const CONTROL_CHARS = /\p{Cc}/u;
/** Control characters other than newline. */
const CONTROL_CHARS_EXCEPT_NEWLINE = /[^\P{Cc}\n]/gu;

/**
 * Single source of truth for the enquiry form and the POST /enquiries body.
 * Strict: unknown keys (including __proto__ / constructor) are rejected.
 */
export const EnquirySchema = z.strictObject({
  productId: ProductIdSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name')
    .max(ENQUIRY_LIMITS.name, `Name must be at most ${ENQUIRY_LIMITS.name} characters`)
    // Rejected (not stripped): the name ends up in an email header, so CR/LF is never acceptable.
    .refine((value) => !CONTROL_CHARS.test(value), 'Name contains invalid characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(ENQUIRY_LIMITS.email, 'Email address is too long')
    .pipe(z.email('Please enter a valid email address')),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 ()-]{0,30}$/, 'Phone may only contain digits, spaces, +, - and brackets')
    .optional(),
  message: z
    .string()
    .max(ENQUIRY_LIMITS.message, `Message must be at most ${ENQUIRY_LIMITS.message} characters`)
    .overwrite((value) => value.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS_EXCEPT_NEWLINE, ''))
    .optional(),
  /**
   * Honeypot: hidden from humans, so it should arrive empty. It is accepted here on purpose:
   * the API answers 201 without sending, so bots get no signal that they were detected.
   */
  website: z.string().max(200).optional(),
});

export type EnquiryInput = z.input<typeof EnquirySchema>;
export type Enquiry = z.output<typeof EnquirySchema>;

export const EnquiryCreatedSchema = z.object({ id: z.string() });
export type EnquiryCreated = z.infer<typeof EnquiryCreatedSchema>;
