import type { FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorCode, ErrorEnvelope, FieldError } from '@catalogue/shared';
import {
  MailDeliveryError,
  NotFoundError,
  UpstreamUnavailableError,
  ValidationError,
} from '../../domain/errors.js';
import {
  ForbiddenOriginError,
  RateLimitedError,
  UnsupportedMediaTypeError,
  UriTooLongError,
} from '../errors.js';
import type { App } from '../types.js';

interface MappedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: FieldError[];
}

/** Fixed client-facing messages for framework errors; their own messages are never echoed. */
const FALLBACK_BY_STATUS: Record<number, Omit<MappedError, 'status'>> = {
  400: { code: 'VALIDATION_ERROR', message: 'The request could not be understood' },
  404: { code: 'NOT_FOUND', message: 'Resource not found' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
};

const INTERNAL: MappedError = {
  status: 500,
  code: 'INTERNAL',
  message: 'Something went wrong. Please try again later.',
};

/** Maps any thrown value to a safe, consistent response. Pure, so it is unit-testable. */
export function mapError(error: unknown): MappedError {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.validation.map((issue) => ({
        path: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
        message: issue.message ?? 'Invalid value',
      })),
    };
  }
  if (error instanceof ValidationError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: error.details,
    };
  }
  if (error instanceof NotFoundError)
    return { status: 404, code: 'NOT_FOUND', message: error.message };
  if (error instanceof ForbiddenOriginError) {
    return { status: 403, code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed' };
  }
  if (error instanceof UnsupportedMediaTypeError) {
    return { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: error.message };
  }
  if (error instanceof UriTooLongError)
    return { status: 414, code: 'URI_TOO_LONG', message: error.message };
  if (error instanceof RateLimitedError)
    return { status: 429, code: 'RATE_LIMITED', message: error.message };
  if (error instanceof UpstreamUnavailableError) {
    return {
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Products are temporarily unavailable. Please try again shortly.',
    };
  }
  if (error instanceof MailDeliveryError) {
    return {
      status: 502,
      code: 'MAIL_DELIVERY_FAILED',
      message: 'We could not send your enquiry. Please try again.',
    };
  }
  const status = statusOf(error);
  const fallback = status === undefined ? undefined : FALLBACK_BY_STATUS[status];
  return fallback && status !== undefined ? { status, ...fallback } : INTERNAL;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  return typeof error.statusCode === 'number' ? error.statusCode : undefined;
}

function sendError(request: FastifyRequest, reply: FastifyReply, mapped: MappedError) {
  const body: ErrorEnvelope = {
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details ? { details: mapped.details } : {}),
      requestId: request.id,
    },
  };
  return reply.status(mapped.status).header('cache-control', 'no-store').send(body);
}

export function registerErrorHandler(app: App): void {
  app.setErrorHandler((error, request, reply) => {
    const mapped = mapError(error);
    if (mapped.status >= 500) {
      // Full detail (stack, upstream cause) goes to logs only, never to the client.
      request.log.error({ err: error, code: mapped.code }, 'request failed');
    } else {
      request.log.info({ code: mapped.code, status: mapped.status }, 'request rejected');
    }
    return sendError(request, reply, mapped);
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(request, reply, { status: 404, code: 'NOT_FOUND', message: 'Route not found' }),
  );
}
