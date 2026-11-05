# 0003: SMTP to Mailpit locally, SES in production

- Status: accepted
- Date: 2026-11-05

## Context

The enquiry acceptance criterion requires "the sales inbox receives an email". The reviewer must be able to see this without creating accounts or paying for anything.

## Decision

- The API sends mail over SMTP through a `Mailer` port, implemented by `SmtpMailer` (nodemailer).
- Locally, docker compose runs **Mailpit**, which catches all SMTP and shows it in a web UI at http://localhost:8025.
- In production the same adapter points at AWS SES SMTP with TLS (`SMTP_REQUIRE_TLS=true` on 587, or `SMTP_SECURE=true` on 465). The config refuses non-TLS SMTP when `NODE_ENV=production`.
- Sending is synchronous: the API returns 201 only after the provider accepts the message, and 502 otherwise.

## Consequences

- No accounts and no credentials locally, and nothing can accidentally email a real person.
- Compose runs the API with `NODE_ENV=development` because Mailpit has no TLS. The production checks stay strict rather than being weakened for local use.
- Synchronous sending ties request latency to the mail provider, and a provider outage loses the enquiry (the user is told and can retry). The production path is persist → SQS → worker → SES with retries and a DLQ, behind the same `Mailer`/service boundary (see DECISIONS.md).
