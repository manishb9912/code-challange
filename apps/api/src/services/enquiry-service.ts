import { randomUUID } from 'node:crypto';
import type { Enquiry, EnquiryCreated } from '@catalogue/shared';
import { buildEnquiryEmail } from '../domain/enquiry-email.js';
import { MailDeliveryError, ValidationError } from '../domain/errors.js';
import type { Logger } from '../ports/logger.js';
import type { Mailer } from '../ports/mailer.js';
import type { ProductSource } from '../ports/product-source.js';

export interface EnquiryDependencies {
  source: ProductSource;
  mailer: Mailer;
  salesInbox: string;
  from: string;
  logger: Logger;
  newId?: () => string;
}

/**
 * Sends a customer's enquiry to the sales inbox. Synchronous by design for the PoC: success
 * is only reported once the mail provider has accepted the message. The production path is
 * persist + queue (SQS) + worker, behind this same interface.
 * Logs carry the enquiry id and product id only, never the customer's details.
 */
export class EnquiryService {
  private readonly newId: () => string;

  constructor(private readonly deps: EnquiryDependencies) {
    this.newId = deps.newId ?? randomUUID;
  }

  /** `enquiry` has already been validated against the shared EnquirySchema at the HTTP edge. */
  async submit(enquiry: Enquiry): Promise<EnquiryCreated> {
    const enquiryId = this.newId();

    if (enquiry.website) {
      // Honeypot filled: look successful so bots learn nothing, but send nothing.
      this.deps.logger.info({ enquiryId }, 'honeypot_triggered');
      return { id: enquiryId };
    }

    const product = await this.deps.source.getProduct(enquiry.productId);
    if (!product) {
      throw new ValidationError([{ path: 'productId', message: 'Unknown product' }]);
    }

    const email = buildEnquiryEmail({
      enquiryId,
      enquiry,
      product,
      salesInbox: this.deps.salesInbox,
      from: this.deps.from,
    });

    try {
      await this.deps.mailer.send(email);
    } catch (error) {
      this.deps.logger.error({ enquiryId, err: error }, 'enquiry email failed');
      throw new MailDeliveryError({ cause: error });
    }

    this.deps.logger.info({ enquiryId, productId: product.id }, 'enquiry sent');
    return { id: enquiryId };
  }
}
