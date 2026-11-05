import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UPSTREAM_UNAVAILABLE',
  'MAIL_DELIVERY_FAILED',
  'RATE_LIMITED',
  'FORBIDDEN_ORIGIN',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'URI_TOO_LONG',
  'INTERNAL',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const FieldErrorSchema = z.object({ path: z.string(), message: z.string() });
export type FieldError = z.infer<typeof FieldErrorSchema>;

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(FieldErrorSchema).optional(),
    requestId: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
