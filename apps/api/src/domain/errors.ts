import type { FieldError } from '@catalogue/shared';

/** Base for expected, typed failures. The HTTP layer maps each subclass to a status code. */
export abstract class DomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: 'Product' | 'Category') {
    super(`${resource} not found`);
  }
}

export class ValidationError extends DomainError {
  constructor(public readonly details: FieldError[]) {
    super('Request validation failed');
  }
}

/** The product data source could not be reached or returned unusable data. */
export class UpstreamUnavailableError extends DomainError {
  constructor(reason: string, options?: ErrorOptions) {
    super(`Product source unavailable: ${reason}`, options);
  }
}

export class MailDeliveryError extends DomainError {
  constructor(options?: ErrorOptions) {
    super('Email could not be delivered', options);
  }
}
