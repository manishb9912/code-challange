# Product catalogue PoC: browse, search, product details and enquiry by email

## Summary

This PR adds a product catalogue proof of concept built to grow rather than be thrown away: a **React + TypeScript** web app and a **Node + TypeScript (Fastify)** API in one npm-workspaces repo. They share zod schemas for the API contract, so the contract is defined once.

- Product data comes from the Fake Store API **only through our backend**, mapped into our own domain model.
- Enquiries are emailed to the sales inbox. Locally that's Mailpit.
- Everything runs with `cp .env.example .env && docker compose up --build`.

The three things the brief says will change (data source, look and feel, email provider) each sit behind a boundary: the `ProductSource` port, design tokens in `theme.css`, and the `Mailer` port.

## What was built, by acceptance criterion

| Criterion                                                                    | How it's met                                                                                                                                                                                                                                                                                                            | Tests                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Home**: the 5 chosen "top rated" products are shown                        | `GET /api/v1/products/featured` returns `FEATURED_PRODUCT_IDS` in the chosen order (max 5; unknown ids are skipped and logged). The home page renders them as tiles.                                                                                                                                                    | `featured.routes.test.ts`, `HomePage.test.tsx`                            |
| **Category**: top rated plus additional products                             | `GET /api/v1/categories` feeds the header links. `GET /api/v1/categories/:slug/products` returns `{ category, topRated (top 3 by rating, tie-break on review count), others: Page }` with no overlap.                                                                                                                   | `catalogue.routes.test.ts`, `top-rated.test.ts`, `CategoryPage.test.tsx`  |
| **Search**: only products matching the term                                  | `GET /api/v1/products?q=`. Every token must appear in title, description or category; plain `includes`, no RegExp; title matches first; blank term → 400; max 100 chars. The URL-driven search form submits on the button or Enter.                                                                                     | `search.test.ts`, `catalogue.routes.test.ts`, `SearchPage.test.tsx`       |
| **Product**: a tile opens the details page                                   | `GET /api/v1/products/:id` (strict id pattern, 404 if unknown). The page shows image, category, price, rating, description and an Enquire button.                                                                                                                                                                       | `catalogue.routes.test.ts`, `ProductPage.test.tsx`                        |
| **Enquiry**: the sales inbox gets an email and the customer sees "Thank you" | `POST /api/v1/enquiries` validates with the shared strict schema, looks the product up **server-side**, emails `SALES_INBOX` with `Reply-To` set to the customer, an escaped HTML part and a text part, and returns 201. "Thank you" shows **only after a 201**; a 502 or 429 shows an error and keeps the form values. | `enquiry.routes.test.ts`, `enquiry-email.test.ts`, `EnquiryPage.test.tsx` |

## Key decisions and trade-offs

- **Ports and adapters, kept light** (ADR: `docs/adr/0002-ports-and-adapters.md`). Business logic is pure and unit-tested. ESLint enforces the dependency rule.
- **Shared zod schemas** (ADR: `docs/adr/0001-monorepo-shared-schemas.md`) drive API validation, form validation, OpenAPI and client response checks.
- **Caching** (ADR: `docs/adr/0005-caching-strategy.md`): TTL, single-flight and serve-stale-on-error in the API, plus `Cache-Control`/`ETag` for a CDN.
- **In-memory search** (ADR: `docs/adr/0004-in-memory-search.md`) because Fake Store has none. The contract (`Page<T>`, `limit`/`offset`) is ready for a real index.
- **Same origin via nginx, no CORS** (ADR: `docs/adr/0006-same-origin-no-cors.md`).
- **Synchronous email** (ADR: `docs/adr/0003-mailpit-local-email.md`). It's honest (no false "Thank you"), but enquiries aren't persisted; the outbox/queue is the first next step.
- Assumptions for every acceptance criterion and every cut are recorded in `DECISIONS.md`.

## Security summary

Full table in `SECURITY.md`.

- **XSS**: strict CSP from nginx and the API (no inline scripts or styles; 0 violations in a headless browser across all routes), `dangerouslySetInnerHTML` banned by lint, upstream text rendered as text, email HTML escaped, image URLs limited to https on allowlisted hosts.
- **Injection / SSRF**: strict `:id`/`:slug` patterns, upstream URLs built under a fixed base with redirects refused, no user-input RegExp, CR/LF rejected in email header fields, prototype-pollution keys rejected. **There is no database, so no SQL surface.** The parameterised-queries rule is recorded for when one is added.
- **CSRF**: no cookies or sessions; POSTs require an allowlisted `Origin` (403) and JSON (415).
- **Abuse**: per-IP rate limits (global 100/min, enquiries 5/min, 429 with `Retry-After`), honeypot, 10 KB body limit, URL/param/query caps, upstream concurrency cap.
- **Errors and logs**: one error envelope with a `requestId`, never stack traces; PII redacted from logs (and never logged by the code in the first place).
- **Supply chain and containers**: pinned versions plus lockfile, `npm audit` (production dependencies: 0 vulnerabilities), gitleaks, Dependabot; non-root, read-only containers with all capabilities dropped and no secrets baked in.

## Scalability summary

- The API is stateless. The cache and rate-limit counters sit behind interfaces with Redis replacements documented.
- Pagination is in the contract from day one.
- Content-hashed assets are cached immutably, and `index.html` is served `no-cache`.
- Routes are code-split and images lazy-loaded.
- Health (`/health`) and readiness (`/ready`) probes, plus graceful shutdown on SIGTERM.
- AWS path: S3 + CloudFront, ECS Fargate behind an ALB, ElastiCache, SES, SQS + DLQ, Secrets Manager, WAF (see DECISIONS.md).

## How to test locally

```bash
cp .env.example .env && docker compose up --build
# web http://localhost:8080 · API docs http://localhost:3000/api/v1/docs · Mailpit http://localhost:8025

npm ci && npm run verify          # lint + typecheck + 220 tests (no network)
npm run test:coverage
```

Walk-through of each criterion: see README → Seeing the acceptance criteria (`README.md`).

## Screenshots

_TODO (author): add screenshots of the home, category, search, product and enquiry "Thank you" pages, and the email in Mailpit._

## Known gaps and next steps

- Enquiries aren't persisted. Next: persist + SQS outbox + worker → SES (return 202).
- The hourly enquiry cap isn't enforced in-process (`@fastify/rate-limit` runs one limiter per request), so it belongs at the edge (AWS WAF). There's no CAPTCHA.
- The cache and rate limits are in memory, so a shared Redis store is needed for multiple instances.
- Search is substring-based ("mens" also matches "womens"); a real index (OpenSearch / Postgres FTS) is the upgrade.
- The local stack is HTTP-only and runs the API with `NODE_ENV=development` (Mailpit has no TLS).
- No Playwright end-to-end test yet. The enquiry flow was verified by hand against the docker stack.

Full list in `DECISIONS.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
