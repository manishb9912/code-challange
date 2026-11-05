import type { OutgoingEmail } from '../src/domain/email.js';
import type { Mailer } from '../src/ports/mailer.js';

/** Records sent mail instead of talking SMTP. Set `failWith` to simulate a provider outage. */
export class SpyMailer implements Mailer {
  readonly sent: OutgoingEmail[] = [];
  failWith: Error | undefined;
  closed = false;

  async send(email: OutgoingEmail): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(email);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
