export interface EmailAddress {
  name?: string;
  address: string;
}

/** A provider-neutral email message. */
export interface OutgoingEmail {
  to: EmailAddress;
  from: EmailAddress;
  replyTo: EmailAddress;
  subject: string;
  text: string;
  html: string;
}
