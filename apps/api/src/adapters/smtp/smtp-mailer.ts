import nodemailer, { type Transporter } from 'nodemailer';
import type { OutgoingEmail } from '../../domain/email.js';
import type { Mailer } from '../../ports/mailer.js';

export interface SmtpOptions {
  host: string;
  port: number;
  /** Implicit TLS (e.g. port 465). */
  secure: boolean;
  /** Refuse to send unless STARTTLS succeeds (e.g. port 587 against SES). */
  requireTls: boolean;
  user?: string;
  pass?: string;
}

/**
 * SMTP via nodemailer: Mailpit locally, AWS SES SMTP (or any provider) in production.
 * Certificate verification is left at nodemailer's secure default and never disabled.
 */
export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      requireTLS: options.requireTls,
      ...(options.user && options.pass ? { auth: { user: options.user, pass: options.pass } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    await this.transporter.sendMail({
      to: email.to,
      from: email.from,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  async close(): Promise<void> {
    this.transporter.close();
  }
}
