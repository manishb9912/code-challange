import { describe, expect, it } from 'vitest';
import {
  MailDeliveryError,
  NotFoundError,
  UpstreamUnavailableError,
  ValidationError,
} from '../../domain/errors.js';
import { mapError } from './error-handler.js';

describe('mapError', () => {
  it.each([
    [new NotFoundError('Product'), 404, 'NOT_FOUND'],
    [new ValidationError([{ path: 'q', message: 'Required' }]), 400, 'VALIDATION_ERROR'],
    [new UpstreamUnavailableError('timeout'), 503, 'UPSTREAM_UNAVAILABLE'],
    [new MailDeliveryError(), 502, 'MAIL_DELIVERY_FAILED'],
  ])('maps %o to %i %s', (error, status, code) => {
    expect(mapError(error)).toMatchObject({ status, code });
  });

  it('never exposes upstream detail for a 503', () => {
    const mapped = mapError(new UpstreamUnavailableError('ECONNREFUSED 104.21.0.1:443'));
    expect(mapped.message).not.toContain('ECONNREFUSED');
  });

  it('hides unknown errors behind a generic 500', () => {
    expect(mapError(new Error('connection string postgres://admin:hunter2@db'))).toEqual({
      status: 500,
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again later.',
    });
  });

  it('uses fixed messages for framework errors rather than echoing them', () => {
    const frameworkError = Object.assign(new Error('Body is too large: internal detail'), {
      statusCode: 413,
    });
    expect(mapError(frameworkError)).toEqual({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    });
  });
});
