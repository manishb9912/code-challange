import type { OutgoingEmail } from '../domain/email.js';

/**
 * Sends email. SMTP (Mailpit locally, SES SMTP in production) today; an SES SDK adapter or a
 * queue-backed sender can replace it without touching EnquiryService.
 */
export interface Mailer {
  /** Resolves once the provider has accepted the message; rejects otherwise. */
  send(email: OutgoingEmail): Promise<void>;
  close(): Promise<void>;
}
