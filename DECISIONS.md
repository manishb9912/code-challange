# Decisions and assumptions

The acceptance criteria deliberately leave gaps. This file records how each gap was filled, what was cut or simplified and why, how the design grows past the PoC, and what comes next. The significant decisions also have short ADRs in [docs/adr/](docs/adr/). The plan that preceded the build is in [docs/SPEC.md](docs/SPEC.md).

## Assumptions, by acceptance criterion

### Home: "I have chosen 5 products to be top rated → I see those 5 featured products"

- "I have chosen" means the entrepreneur **curates** the list. There is no admin UI in the MVP, so the choice lives in config: `FEATURED_PRODUCT_IDS`, a comma-separated list displayed **in the chosen order**.
- "Top rated" (GIVEN) and "featured" (THEN) are the **same curated list**. Nothing is computed from ratings on the home page.
- At most 5 are shown. Unknown or missing ids are **skipped with a warning log**, never an error, so a config typo can't take the home page down (and fewer than 5 may show). Duplicate ids are ignored.

### Category: "I click a category link → I see top rated products for that category and additional products"

- Categories come from the data source (Fake Store's four), with URL-safe slugs (`men's clothing` → `mens-clothing`) and display labels (Fake Store's `jewelery` shows as "Jewellery").
- Category "top rated" is **derived**: the top **3** by average rating, tie-broken by review count. It sits behind a `TopRatedStrategy` function type, so per-category curation can replace it later.
- "Additional products" are the rest of the category, **excluding** the top-rated ones, sorted by title.
- The additional products are paginated in the API (`limit`/`offset`). The UI shows the first page, which today holds everything.

### Search: "I enter a term and click Search → I only see products with text matching that term"

- Search is **global**, not scoped to the current category, and runs **on the backend**.
- It's case-insensitive and whitespace-tokenised, and **every token must match** somewhere in the title, description or category name. Products whose titles match more tokens rank first.
- The button **and** Enter submit. Blank input can't be submitted (button disabled; API returns 400). The maximum length is 100 characters. The term lives in the URL (`/search?q=`), so back, refresh and share work.
- An explicit empty state reads: "No products match 'x'".
- Matching is by substring, so "mens" also matches "womens" (see Known limitations).

### Product page: "I click a product tile → I see the product details page"

- The page shows the image, title, category (as a link), price in USD, rating, description and an **Enquire** button.
- An unknown or invalid id shows a "Product not found" page.

### Enquiry: "I click Enquire, complete the form with my contact details and submit → the sales inbox receives an email and I see 'Thank you'"

- **One enquiry per product.** The brief mentions "products they want" (plural); an enquiry basket is a next step.
- Contact details: **name and email** (required), **phone and message** (optional).
- The form is a separate route, `/product/:id/enquire`, so it's linkable and simple to test.
- The email goes to `SALES_INBOX`, with `Reply-To` set to the customer, so sales can answer directly. Product details in the email are **looked up server-side**; the client only sends the product id.
- **No confirmation email to the customer.** Without verifying the address, that would let anyone use the form to send mail to third parties.
- Sending is **synchronous**: "Thank you" appears only after the API returns 201. If sending fails, the user sees an error (502) and keeps what they typed.
- Enquiries are **not persisted** (no database in scope). This is a risk; see Next steps.
- **No CAPTCHA** (it would need a third-party account). Instead: rate limit (5/min per IP), a hidden honeypot field and an Origin check.

### General

- Users are **anonymous**: no accounts, therefore no cookies and no session-based CSRF surface.
- USD only, English only, responsive for desktop and mobile, WCAG 2.1 AA as the target.
- Product images are **hotlinked from Fake Store over HTTPS**. Those image requests are the only browser traffic to a third party; all product data goes through our API. (Verified in a headless browser against the docker stack.)

## Dropped or simplified, and why

| What                             | Decision                               | Why                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hourly enquiry limit (20/hour)   | **Dropped in-process**; 5/min enforced | `@fastify/rate-limit` runs one limiter per request. Combining two windows made one silently ineffective (caught by tests). The longer window belongs at the edge (AWS WAF rate-based rule). Decided with the human reviewer. |
| Brotli compression               | gzip only                              | The stock nginx image has no brotli module. A custom nginx build isn't worth it; CloudFront does brotli in production.                                                                                                       |
| Playwright end-to-end test       | Cut                                    | Time-box. The enquiry flow was verified by hand against the docker stack (email in Mailpit, headers, 429, CSP in headless Edge), and every acceptance criterion has API and UI tests.                                        |
| CORS                             | Not enabled                            | Same-origin through nginx/Vite is stricter and simpler ([ADR 0006](docs/adr/0006-same-origin-no-cors.md)).                                                                                                                   |
| API docs "dev only"              | Gated by `API_DOCS_ENABLED` instead    | The docker stack runs as a local stack, and the reviewer benefits from `/api/v1/docs`. Swagger UI uses its own hash-based CSP on its routes only.                                                                            |
| Search quality                   | Substring matching                     | Correct by the criterion's wording ("text matching that term") and safe (no RegExp). Relevance work needs a real search index.                                                                                               |
| Pagination in the UI             | First page only                        | The contract supports it, but no category has more than 24 products today.                                                                                                                                                   |
| `NODE_ENV=production` in compose | Compose uses `development`             | Production config requires TLS for SMTP, and Mailpit has none. Keeping the production checks strict mattered more.                                                                                                           |

## How the design grows

- **Swapping the product data source.** Write a new `ProductSource` adapter (e.g. Postgres, a PIM or Shopify) that maps to our domain model, and wire it in `app.ts`. Caching, services, routes, the API contract and the UI stay the same. Ids are strings and slugs are ours, so non-numeric ids fit.
- **Reskinning.** The creative agency's look is a token change in `apps/web/src/styles/theme.css`: colours, type, spacing, radii and shadows. Components use CSS Modules that reference tokens only, and there's no UI library to fight.
- **Swapping the email provider.** Write a new `Mailer` adapter (e.g. the SES SDK, SendGrid or Postmark), or point `SmtpMailer` at SES SMTP with TLS via env vars only.
- **Scaling search.** Introduce a `SearchIndex` port backed by OpenSearch or Postgres full-text search. `GET /products?q=` keeps its contract and adds relevance, stemming and word boundaries. Cursor pagination replaces offset once a database exists.
- **Horizontal scaling.** The API is stateless. The only in-process state is the cache (`Cache` port → Redis/ElastiCache adapter) and the rate-limit counters (`@fastify/rate-limit` `redis` option). Both have documented shared-store replacements.
- **Reliable enquiries.** `POST /enquiries` persists the enquiry, publishes to SQS and returns 202; a worker sends via SES with retries and a DLQ. The `EnquiryService` and `Mailer` boundaries already separate "accept" from "deliver".
- **Deploying to AWS** (documented here, no infrastructure-as-code):
  - S3 + CloudFront for the web build, with CloudFront also routing `/api/*` to the ALB (same origin).
  - ECS Fargate behind an ALB for the API, with autoscaling.
  - ElastiCache Redis for the cache and rate limits; SES for email; SQS + DLQ for enquiries.
  - Secrets Manager / SSM for configuration; ACM certificates; WAF on CloudFront/ALB.
  - CloudWatch logs, metrics and alarms (5xx rate, upstream errors, 429s, mail failures).
- **Admin curation.** Replace `ConfigFeaturedProductsProvider` with a CMS- or database-backed `FeaturedProductsProvider`; per-category curation slots in as a `TopRatedStrategy`.

## Known limitations

- Search is in-memory substring matching ("mens" matches "womens"), with no relevance tuning, stemming or typo tolerance.
- The cache and rate-limit counters are per instance and are lost on restart.
- Enquiries aren't stored; a mail outage loses the enquiry (the user sees an error and can retry).
- There's no CAPTCHA, and no in-process hourly enquiry cap (edge control needed).
- The image placeholder only covers disallowed or invalid URLs, not images that fail to load.
- The local stack is HTTP-only and not production-configured (see SECURITY.md).
- Product data (titles, ratings) is whatever Fake Store returns. The mapper trims whitespace but doesn't otherwise clean it.
- The main JS bundle is ~119 KB gzipped, largely React plus zod.

## Open questions for the entrepreneur

- What is the exact privacy/consent wording under the enquiry form, and how long should enquiries be retained?
- Who maintains the featured list, and how often? (This decides when an admin UI is needed.)
- Should customers get a confirmation email once addresses can be verified?
- Should a single enquiry cover several products (an enquiry basket)?
- What are the real sales inbox and sending domain? (These are needed for SES domain verification, SPF/DKIM/DMARC.)
- Are prices always USD, and is any market outside English-speaking ones planned?

## With one more day

1. **Persist enquiries plus an outbox.** Store first (Postgres via a repository port), send via SQS + worker, and return 202. This removes the lost-enquiry risk.
2. **Playwright smoke test** of the enquiry flow against docker compose, asserting on the Mailpit API, run in CI.
3. **Redis adapters** for the cache and rate limits, and a compose profile to exercise them.
4. **Edge controls**: a WAF rate rule for the hourly enquiry cap, plus CSP violation reporting.
5. **Search improvements**: word-boundary matching and a basic relevance score, behind the same pure-function interface.
6. **Accessibility pass** with axe in tests and manual screen-reader checks.
7. **Bundle trim**: try `zod/mini` in the web client.
