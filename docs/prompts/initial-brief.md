# Prompt for Claude Code — Product Catalogue PoC

> How to use: start Claude Code in an empty folder (`git init` first), switch to **plan mode** (Shift+Tab), and paste everything below the line. Review the spec it writes before letting it build. That review step is your "I directed the AI" story for AI_USAGE.md.

---

You are helping me with a take-home challenge for an "AI-Native Engineer" role. The reviewers score **judgement, not feature count**: clean boundaries, sensible assumptions written down, honest cuts, readable code, security basics, tests on the critical path, and evidence that I directed and reviewed the AI. I must be able to defend every line in an interview, so keep the solution **small, conventional and explainable**. Don't be clever, and don't add features nobody asked for. Apply security and scalability practices **in proportion**: implement what fits this PoC, and where something doesn't apply (e.g. there is no SQL database), say so explicitly and show how the design protects against it later. Never add a fake measure just to tick a box.

## 1. The brief (summary)

An entrepreneur wants a product catalogue MVP. Customers browse and search products and submit an enquiry for a product. Use the **Fake Store API** (`https://fakestoreapi.com`) as the product data source for now. **This is not a throwaway prototype.** The product data source, the look and feel, and the email provider are all expected to change, so the design must let each of them be swapped without rewriting the rest.

### Hard constraints (must all be true at the end)
1. Client: **React web app in TypeScript**. Backend: **Node.js in TypeScript**.
2. The client **never calls Fake Store directly**. All product data goes through our backend.
3. Any infrastructure must be AWS-compatible (Docker images and plain env config are enough; no vendor lock-in).
4. A reviewer can run everything locally in **under 10 minutes** with **`cp .env.example .env && docker compose up`**.
5. **No secrets committed.** Provide `.env.example`, and `.gitignore` the real `.env`.
6. **No paid services or accounts** needed. Local email goes to **Mailpit** (a container that catches SMTP and has a web UI).

### Acceptance criteria (verbatim intent)
- **Home**: GIVEN I have chosen 5 products to be "top rated", WHEN I view the home page, THEN I see those 5 featured products.
- **Category**: GIVEN products are organised into categories, WHEN I click a category link, THEN I see top rated products for that category AND additional products in that category.
- **Search**: GIVEN I've entered a search term in the search bar, WHEN I click the search button, THEN I only see products with text matching that term.
- **Product**: WHEN I click a product tile, THEN I see the product details page.
- **Enquiry**: GIVEN I'm viewing a product and click **Enquire** and complete the form with my contact details, WHEN I submit, THEN the sales inbox receives an email AND I see a "Thank you" message.

## 2. Decisions already made (follow these; flag it if you think one is wrong)

### Repo layout (npm workspaces monorepo)
```
apps/api          Fastify + TypeScript backend
  src/
    config/       zod-validated env config (fail fast)
    domain/       pure logic: search matcher, top-rated strategy, errors (no I/O, no framework imports)
    ports/        interfaces: ProductSource, Mailer, FeaturedProductsProvider, Cache
    adapters/     fakestore/, smtp/, memory-cache/ (implement ports)
    services/     CatalogueService, EnquiryService (use ports only)
    http/         routes, plugins (security, rate-limit, error handler), DTO mapping
    app.ts        buildApp(deps): composition root
    server.ts     process entry: listen + graceful shutdown
apps/web          Vite + React + TypeScript frontend
  src/ api/ components/ features/{home,category,search,product,enquiry}/ layout/ styles/theme.css
packages/shared   Shared domain types + zod schemas (API contracts, enquiry validation)
docker-compose.yml  api, web (nginx serving the build and proxying /api), mailpit
.env.example  README.md  DECISIONS.md  SECURITY.md  AI_USAGE.md  CLAUDE.md
docs/adr/         short Architecture Decision Records (one per significant decision)
.github/workflows/ci.yml   lint + typecheck + test + audit
.github/dependabot.yml
```
Node 22 LTS. Pin dependency versions and commit the lockfile. ESLint + Prettier. Strict TypeScript (`strict`, `noUncheckedIndexedAccess`).
**Dependency rule, enforced with ESLint `import/no-restricted-paths`:** `domain` imports nothing internal; `services` import `domain` + `ports` only; `adapters` import `ports` + `domain`; only `app.ts` knows the concrete adapters; `http` never imports adapters.

### Backend architecture (ports & adapters, kept light)
- **Domain model is ours, not Fake Store's.** Define it in `packages/shared`:
  `Product { id: string; title; description; price: { amount: number; currency: 'USD' }; category: { slug; name }; imageUrl; rating: { average: number; count: number } }` and `Category { slug; name }`.
  Use string ids so a future data source with non-numeric ids still fits.
- **Port `ProductSource`** with `listProducts()`, `getProduct(id)` and `listCategories()`. **Adapter `FakeStoreProductSource`** maps the Fake Store shape to the domain model.
  - It uses `fetch` over **HTTPS only** with a 5s timeout. Failures map to a typed `UpstreamUnavailableError`.
  - It **validates the upstream response with zod**: never trust the third party, and drop or log malformed items.
  - Category slugs must be URL-safe (`men's clothing` → `mens-clothing`), and display names get a label map (Fake Store spells it `jewelery`, so show "Jewellery").
- **Port `Cache`** (`get/set` with TTL) with an in-memory adapter. A `CachedProductSource` decorator wraps any source, with these behaviours:
  - The TTL comes from env (default 5 min).
  - **Single-flight / request coalescing**: concurrent cache misses trigger only one upstream call, which prevents a cache stampede.
  - **Serve-stale-on-error**: if the upstream fails and stale data exists, return it and log a warning.
  - The `Cache` port means Redis/ElastiCache can replace memory when there are multiple instances.
  - Fake Store has no search or filtering endpoints and only about 20 products, so we load the list and filter in memory. Document that this won't scale, and say what replaces it (a DB plus a search index, e.g. OpenSearch).
- **Port `FeaturedProductsProvider`**. Its implementation reads `FEATURED_PRODUCT_IDS` (a comma-separated list, exactly as the entrepreneur "chose" them; display in that order). Unknown or missing ids are skipped and logged as a warning, never a crash. The home page shows at most 5.
- **Category "top rated"** is derived, not curated: the top **3** products in the category by `rating.average`, tie-broken by `rating.count`. Put this behind a small `TopRatedStrategy` function so it can be swapped for curation later. "Additional products" are the rest of the category, **excluding** the top-rated ones, sorted by title.
- **Search** lives in a pure function: trim the term and lowercase it, split it on whitespace, and match a product only if **every** token appears (as a plain-string `includes`, **never building a RegExp from user input**, which avoids ReDoS) in its title, description or category name. Rank title matches first. A blank term returns 400. Max term length is 100 characters.
- **Port `Mailer`** with `send({ to, from, replyTo, subject, text, html })`. **Adapter `SmtpMailer`** uses nodemailer and points at Mailpit locally. In production it can use TLS (`SMTP_SECURE`/STARTTLS) against AWS SES SMTP, and an SES SDK adapter would be another drop-in. Settings: `SALES_INBOX`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` (the last two are blank locally).
- **`EnquiryService`**: validate with the shared zod schema, then **look up the product server-side by id**. Never trust a title or price sent by the client. Build the email (see the security section for escaping), set `Reply-To` to the customer's email, and send to `SALES_INBOX`. If the send fails, return 502 so the UI shows an error with a retry. **Never show "Thank you" when nothing was sent.** Note in DECISIONS.md that the next step is to persist the enquiry first and send through an outbox/queue (SQS + worker).
- **Composition root** (`buildApp(deps)`) wires adapters from config, so tests inject fakes. Config is loaded from env and validated with zod at startup (fail fast with a clear message; never print secret values).

### API: versioned under `/api/v1`, JSON only, consistent error envelope `{ error: { code, message, details?, requestId } }`
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/health` | liveness (no dependencies checked) |
| GET | `/api/v1/ready` | readiness (config loaded; upstream reachable or cache warm) |
| GET | `/api/v1/products/featured` | home page's curated list |
| GET | `/api/v1/categories` | `[{ slug, name }]` |
| GET | `/api/v1/categories/:slug/products` | `{ category, topRated: Product[], others: Page<Product> }`, 404 if slug unknown |
| GET | `/api/v1/products?q=term&limit=&offset=` | search, returns `Page<Product>`; 400 if q is missing or blank |
| GET | `/api/v1/products/:id` | 404 if not found |
| POST | `/api/v1/enquiries` | 201 `{ id }` on success, 400 with field errors, 415 if the body isn't JSON, 429 when rate-limited, 502 if the mail send fails |

- **`Page<T> = { items: T[]; total: number; limit: number; offset: number }`.** The default limit is 24 and the max is 100. Pagination is in the contract now, so the UI and clients don't break when the catalogue grows past 20 items. The UI can just request the first page for now.
- Every route declares a **JSON schema for params, query, body and response** (generate it from zod with `fastify-type-provider-zod` or `zod-to-json-schema`). Unknown properties are stripped or rejected.
- Serve **OpenAPI docs** via `@fastify/swagger` at `/api/v1/docs` (dev only), so the contract is self-documenting.
- **HTTP caching**: GET product and category responses send `Cache-Control: public, max-age=60, stale-while-revalidate=300` and an `ETag`, so a CDN like CloudFront can absorb read traffic. Enquiry, error and health responses send `Cache-Control: no-store`.
- Status codes: upstream down with no stale data → 503. Log every request with a **request id** (`X-Request-Id`, accepted from the proxy or generated) and include it in error responses.

### Enquiry schema (in `packages/shared`, used by both the form and the API)
- `productId` (required; string matching `^[A-Za-z0-9_-]{1,64}$`)
- `name` (required, 1–100 chars, trimmed, no control characters)
- `email` (required, valid email, max 254, lower-cased)
- `phone` (optional, `^[+0-9 ()-]{0,30}$`)
- `message` (optional, max 2000 chars; control characters stripped except newlines)
- `website`: a **honeypot**, hidden in the UI, must be empty. If it's filled, the API returns 201 but sends nothing, and logs `honeypot_triggered` without PII.
- The schema is `.strict()`, so unknown keys are rejected.

### Frontend
- Vite + React + TS + **React Router** + **TanStack Query** (loading, error and caching states without hand-rolling them). No Redux, and no UI component library: the creative agency will supply the look.
- **Theming**: all colours, spacing, fonts and radii live as CSS custom properties in one `theme.css` (design tokens). Components use CSS Modules that only reference tokens, so a reskin is a token swap. The UI should be minimalistic, clean and should feel premium.
- One typed API client module (`src/api/client.ts`) using the shared types, with a base URL from config. Components never call `fetch` directly.
- Code is organised by **feature folder**. Routes are lazy-loaded with `React.lazy` (code splitting), there is a top-level **error boundary**, and images use `loading="lazy"` with width and height set.
- Routes: `/` (home), `/category/:slug`, `/search?q=`, `/product/:id`, `/product/:id/enquire` (a separate route: linkable and simple to test), and a 404 route.
- A shared **Layout** has a header with the store name, category links (fetched from the API) and a **search form** with an input and a "Search" button. Enter submits too. The button is disabled when the input is blank, `maxLength=100`, and the query lives in the URL so back/refresh/share work.
- One reusable **ProductTile** (image, title, price, rating) that links to the product page, used on home, category and search pages.
- Every page has a loading state, an error state (with retry) and an empty state ("No products match 'x'"). Use semantic HTML, labelled form fields, visible focus and alt text, and make the layout responsive (WCAG 2.1 AA is the target).
- Enquiry form: client-side validation with the shared zod schema (react-hook-form + zodResolver), inline field errors, and the submit button disabled while submitting (no double submits). On success, replace the form with a **"Thank you"** message that names the product and links back to it. On failure (including 429), show a friendly error and keep what the user typed.
- Format prices with `Intl.NumberFormat`.

## 3. Security requirements (OWASP Top 10 aligned)

Implement these, and document each one in **SECURITY.md** as a table: threat → mitigation in this PoC → production addition. Each mitigation that can be tested gets a test (see §5).

### XSS (cross-site scripting)
- React escapes output by default. **Ban `dangerouslySetInnerHTML`** with the ESLint rule `react/no-danger` set to error. Product descriptions from the upstream are rendered as text only.
- Never build URLs from user input without encoding. Product image URLs are validated server-side to `https:` and an allowlisted host; anything else is replaced with a placeholder. Links only use internal routes.
- **Content-Security-Policy**, set in nginx for the web app and through helmet for the API:
  `default-src 'self'; img-src 'self' https://fakestoreapi.com data:; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. No inline scripts. Check that the Vite build works under this CSP.
- **XSS in the email**: every user-supplied value in the HTML email is HTML-escaped (use a tiny tested `escapeHtml` util, or a template engine with auto-escaping), and the plain-text part is sent too. The subject line has CR/LF stripped.

### Injection (SQL, NoSQL, command, header, path)
- **There is no SQL database in this PoC, so there is no SQL injection surface.** Write that down honestly. Also record the rule for the future DB adapter in CLAUDE.md and SECURITY.md: parameterised queries / ORM only, and no string-concatenated SQL.
- **Path injection / SSRF into the upstream**: `:id` and `:slug` are validated with strict patterns (`^[A-Za-z0-9_-]{1,64}$`) **before** they reach the adapter. The adapter builds upstream URLs with `encodeURIComponent` against a fixed base URL taken from config, so a user can never change the host or path (no `../`, no full URLs).
- **Email header injection**: reject CR/LF in name, email and subject inputs. Use nodemailer's address objects rather than string concatenation.
- **ReDoS**: no user-input regexes. All validation regexes are simple and anchored.
- **No `eval`, `child_process` or dynamic `require`** anywhere. ESLint `no-eval` and `no-implied-eval` are set to error.
- **Prototype pollution**: the zod `.strict()` schemas reject unknown keys, so `__proto__` and `constructor` keys in JSON bodies are rejected. Fastify's default `onProtoPoisoning: 'error'` stays in place.

### CSRF (cross-site request forgery)
- The API is **stateless, uses no cookies and has no auth sessions**, so the browser never attaches ambient credentials. That removes the classic CSRF vector. Document this reasoning.
- Defence in depth anyway, on state-changing routes:
  - Require `Content-Type: application/json` and return 415 otherwise. That blocks cross-site HTML form posts, which can only send simple content types.
  - Check that the `Origin` header is in `ALLOWED_ORIGINS` and return 403 if it isn't.
  - CORS: only allow the configured origin(s), never `*` together with credentials. In Docker it's same-origin via the nginx proxy.
- Future note: if cookies/auth are added, use `SameSite=Lax|Strict; Secure; HttpOnly` cookies plus a CSRF token (`@fastify/csrf-protection`).

### Man-in-the-middle / transport security
- **Production**: TLS terminates at CloudFront/ALB with an ACM certificate. Redirect HTTP → HTTPS and send `Strict-Transport-Security: max-age=31536000; includeSubDomains` (set HSTS only when `NODE_ENV=production` / behind TLS). Document that the local setup is plain HTTP on localhost.
- **Server → upstream**: only `https://` URLs are allowed for the Fake Store base URL, and config validation rejects `http://` in production. TLS certificate verification is **never disabled** (no `NODE_TLS_REJECT_UNAUTHORIZED=0`).
- **Server → SMTP**: TLS in production (`SMTP_SECURE=true` or STARTTLS required).
- **No mixed content**: image URLs are https only.
- Set `trustProxy` correctly (from config), so client IPs and protocol come from the trusted proxy's `X-Forwarded-*` headers only.

### Rate limiting & throttling (abuse, brute force, DoS, cost control)
- `@fastify/rate-limit`, with limits from env:
  - **Global**: e.g. 100 requests/min per IP on all `/api` routes.
  - **Strict on `POST /api/v1/enquiries`**: e.g. 5/min and 20/hour per IP. This stops form spam and protects the email budget and sender reputation.
  - Return `429` with `Retry-After` and the `RateLimit-*` headers.
- **Store behind an interface**: in-memory locally, and document that production needs a **shared store (Redis/ElastiCache)**, because in-memory limits don't hold across multiple instances.
- **Upstream throttling**: single-flight plus cache means user traffic never fans out to Fake Store. Also cap concurrent upstream requests (e.g. `p-limit`, 5) to protect the upstream and ourselves.
- **Edge**: document AWS WAF rate-based rules on CloudFront/ALB as the production first line of defence.
- **Slow-request / resource limits**: body limit 10 KB, `connectionTimeout`/`requestTimeout` set, query-string and param length caps, and pagination `limit` max 100.

### Other security basics
- **Security headers** via `@fastify/helmet` and nginx: CSP (as above), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` / `X-Frame-Options: DENY` (clickjacking), a `Permissions-Policy` that disables the camera, mic and geolocation, and hiding `X-Powered-By` and the nginx `server_tokens`.
- **Error handling**: a central error handler maps typed errors to the envelope. **Never leak stack traces**, upstream error bodies or internal messages to clients (generic message plus `requestId`). Full details go to the logs only.
- **Logging**: structured pino logs with **redaction** of `email`, `phone`, `name`, `message`, `authorization`, `cookie` and `SMTP_PASS`. No PII or secrets in logs.
- **Secrets & config**: everything comes from env, validated at startup. `.env` is gitignored, `.env.example` has safe dummy values, and production uses AWS Secrets Manager / SSM. Add a `gitleaks` (or similar) secret-scan step to CI.
- **Supply chain**: a committed lockfile, `npm ci` in Docker and CI, `npm audit --audit-level=high` in CI, and Dependabot for npm, GitHub Actions and Docker. Keep dependencies minimal.
- **Containers**: multi-stage Docker builds, a slim base image, run as a **non-root user**, only production dependencies in the runtime image, a read-only root filesystem where possible, a `HEALTHCHECK`, and no secrets baked into images (`.dockerignore` excludes `.env`, `.git` and `node_modules`).
- **Privacy**: enquiry PII is used only to send the email and is not stored. Add a short privacy notice line under the form ("We'll use these details only to respond to your enquiry"). Flag the exact consent/legal wording as an open question for the entrepreneur.

## 4. Scalability & maintainability requirements

### Scalability
- **Stateless API**: no in-process session state, so the API scales horizontally behind a load balancer. Every in-process piece of state (cache, rate-limit counters) sits behind an interface with a documented shared-store replacement (Redis).
- **Cache layers**: the TanStack Query cache in the browser → CloudFront and HTTP `Cache-Control`/`ETag` → the API's in-memory/Redis cache → the upstream. Single-flight and serve-stale protect the upstream.
- **Pagination in the contract from day one** (`limit`/`offset`, with a max cap). Note in DECISIONS.md that cursor pagination is the upgrade once a DB exists.
- **Async work**: email is synchronous in the PoC. Document the production path: `POST /enquiries` persists the enquiry, publishes to SQS and returns 202, and a worker sends via SES with retries and a DLQ. The `Mailer` and service boundaries already allow this.
- **Search**: in-memory now. Swap the `ProductSource` / a `SearchIndex` port to OpenSearch or Postgres full-text search later, with no change to the API contract.
- **Frontend performance**: route-level code splitting, lazy images, a production build served by nginx with gzip/brotli and long-lived cache headers on hashed assets (`Cache-Control: public, max-age=31536000, immutable`), and `no-cache` on `index.html`.
- **Operational readiness**: `/health` and `/ready` endpoints, **graceful shutdown** (on SIGTERM, stop accepting connections, drain in-flight requests, close the mailer), and 12-factor config.
- **AWS deployment sketch** (doc only, no IaC): S3 + CloudFront for web; ECS Fargate (or Lambda) behind an ALB for the API with autoscaling; ElastiCache Redis for the cache and rate limits; SES; SQS + DLQ; Secrets Manager; WAF; CloudWatch logs, metrics and alarms.

### Maintainability
- **Clear boundaries**: the folder structure and the ESLint dependency rule from §2. Business logic sits in pure `domain` functions that are easy to unit test.
- **Single source of truth for contracts**: zod schemas in `packages/shared` generate the types, the API validation, the form validation and the OpenAPI docs. A field change happens in one place.
- **Typed errors** (`NotFoundError`, `ValidationError`, `UpstreamUnavailableError`, `MailDeliveryError`) mapped centrally to HTTP responses. No ad-hoc `res.status()` scattered around.
- **Config in one module**, typed and validated, with no `process.env` reads anywhere else (enforced with an ESLint `no-restricted-properties` rule).
- **Consistent code style**: ESLint + Prettier, strict TS, `husky` + `lint-staged` pre-commit (optional), and conventional commits.
- **Tests as a safety net**: test coverage thresholds in Vitest (e.g. 80% lines on `apps/api/src/domain` and `services`). Tests read like the acceptance criteria.
- **Docs**: README, DECISIONS.md, SECURITY.md, short ADRs in `docs/adr/` (e.g. 0001-monorepo-shared-schemas, 0002-ports-and-adapters, 0003-mailpit-local-email, 0004-in-memory-search), plus OpenAPI.
- **Small files, small functions, descriptive names**. No dead code or commented-out code, and no `any` without a justification comment.

## 5. Testing (critical path first; tests must **never** hit the real Fake Store or a real SMTP server)
- **API, using Vitest + `app.inject()`**:
  - Unit tests: the search matcher (incl. special characters like `.*+?`, which must be treated literally), the top-rated strategy, the Fake Store mapper and its zod validation (malformed upstream item), the slug and label map, the enquiry schema (CR/LF, unknown keys, `__proto__`), `escapeHtml`, and the pagination helper.
  - Route tests for every endpoint using an in-memory fake `ProductSource` and a spy `Mailer`. Cover happy paths, 404s, 400 validation (bad id pattern, over-long query, limit over the max), the 502 on mail failure, the honeypot, and that the email uses the **server-side** product data with `Reply-To` set and **HTML-escaped** user input (submit `<script>` in name or message and assert it's escaped).
  - **Security tests**:
    - 429 after N enquiries.
    - 415 for a non-JSON POST.
    - 403 for a disallowed `Origin`.
    - The security headers are present (CSP, nosniff, frame-ancestors).
    - Error responses contain no stack trace.
    - The body limit gives 413.
    - Log redaction (capture logs and assert the email isn't present).
  - **Cache tests**: single-flight (10 concurrent calls → 1 upstream call), serve-stale-on-error, TTL expiry (with fake timers).
  - Adapter tests for `FakeStoreProductSource` with mocked fetch (msw or undici `MockAgent`): mapping, 5xx and timeout → `UpstreamUnavailableError`, ids URL-encoded.
- **Web, using Vitest + React Testing Library + msw**: one test per acceptance criterion (home shows the 5 featured; category shows the top-rated and other sections; search shows only matching results plus the empty state; tile click navigates to details; enquiry submit shows Thank you, a server error or 429 keeps the form, and validation errors show). Add one test that a malicious product description renders as literal text.
- Optional if time allows: one Playwright smoke test of the whole enquiry flow against docker compose, checking Mailpit's API for the email.
- `npm test` at the root runs everything. CI runs lint, typecheck, test with coverage, `npm audit` and a secret scan.

## 6. How I want you to work

1. **Plan first, don't code yet.** Write `docs/SPEC.md`. It should cover the architecture (a short ASCII diagram), the API contract, the mapping from each acceptance criterion to its endpoint, component and test, a **threat model summary** (assets, entry points, top threats → mitigations), the list of assumptions and open questions, and a build order with commit checkpoints. Then **stop and wait for my review.**
2. Once I approve, create the branch `feature/product-catalogue-poc` and build in small vertical slices, one commit per slice, using conventional commit messages:
   scaffold + tooling + lint rules + CI → shared types/schemas → config + error handling + security plugins (helmet, rate-limit, CORS/origin check, logging redaction) → ProductSource + Fake Store adapter + cache → product/category/search endpoints → featured → enquiry + mailer → web layout/home → category → search → product page → enquiry form → docker compose + nginx headers/CSP → docs (README, DECISIONS, SECURITY, ADRs).
3. After each slice, **run lint, typecheck and tests, and fix failures before moving on.** Don't disable lint rules or skip tests to make things pass.
4. If anything in this prompt is ambiguous, conflicts with reality (e.g. the Fake Store response shape is different from what I described), or a security measure would break something (e.g. CSP vs Vite), **tell me and suggest an option**. Don't guess silently, and don't silently weaken a control.
5. Keep a running `docs/ai-notes.md`: each time you change course, hit a bug you introduced, or make a non-obvious choice, add one line. I'll use it as raw material for AI_USAGE.md and will verify it myself.
6. Stay in scope. **No** auth, cart or checkout, database, admin UI, i18n, SSR, Redis container, or infra-as-code beyond docker compose. Design the seams for them and put them in DECISIONS.md under "Next steps" instead.
7. **Don't push or open the PR yourself.** At the end, write `docs/PR_DESCRIPTION.md` and tell me the exact `git push` and `gh pr create` commands to run.

## 7. Documentation to produce

- **README.md**:
  - Stack choice and why (React + TS for the web reach and quickest feedback loop; Node + TS for shared types end to end).
  - Prerequisites (Docker only; Node 22 is optional, for running without Docker).
  - Quick start with `cp .env.example .env && docker compose up --build`, plus the URLs: web on :8080, API on :3000/api/v1/health, API docs on /api/v1/docs, Mailpit UI on :8025.
  - How to view the enquiry email in Mailpit, every env var explained, how to run the tests, how to run without Docker, and the project structure.
- **DECISIONS.md** with these sections:
  - Assumptions, one per acceptance criterion; use the list in §8.
  - Dropped or simplified requirements, and why.
  - How the design grows: swapping the data source, reskinning, swapping the email provider, scaling search, horizontal scaling, and deploying to AWS.
  - Known limitations.
  - What I'd do with one more day.
- **SECURITY.md**: the threat → mitigation → production-addition table covering XSS, injection (incl. the honest "no SQL in the PoC" note), CSRF, MITM/TLS, rate limiting and throttling, clickjacking, SSRF, ReDoS, prototype pollution, secrets, supply chain, containers, logging/PII, and DoS. Also include a "known gaps" section (e.g. no CAPTCHA, in-memory rate limits, local HTTP).
- **docs/adr/**: 4–6 short ADRs (context, decision, consequences).
- **AI_USAGE.md as a TEMPLATE only.** Pre-fill "Tools: Claude Code (model: Claude Opus 5.5)" and a link to CLAUDE.md and docs/SPEC.md. Leave clearly marked `TODO (human)` placeholders for: key prompts, where the AI got it wrong, and time spent (planning/building/testing/reviewing). **Don't invent these; I'll write them honestly.**
- **CLAUDE.md** (committed): the project conventions you are following, i.e. the layout and dependency rule, the commands, "domain model ≠ Fake Store shape", "client never calls upstream", "tests never hit the network", "no PII in logs", "no `dangerouslySetInnerHTML`", "validate all input with shared zod schemas", "parameterised queries only when a DB is added", "never disable TLS verification", "config only via the config module", and so on.
- **docs/PR_DESCRIPTION.md**: summary, what was built (mapped to each acceptance criterion), key decisions and trade-offs, a security and scalability summary, how to test locally, screenshots placeholder, known gaps and next steps.

## 8. Assumptions to record in DECISIONS.md (use these unless you find a reason not to, and tell me if you do)

- **Home**: "I have chosen" means the entrepreneur curates the featured products. Since there's no admin UI in the MVP, the curated list is config (`FEATURED_PRODUCT_IDS`, in the chosen order). "Top rated" in the GIVEN and "featured" in the THEN are treated as the same curated list, not computed from ratings. Missing ids are skipped, so fewer than 5 can show; nothing errors.
- **Category**: the categories come from the data source. "Top rated" is computed as the top 3 by average rating (tie-break: review count), and "additional" is everything else in the category, deduplicated. Pagination exists in the API, and the UI shows the first page.
- **Search**: global, not category-scoped. It's case-insensitive, all tokens must match, and it searches title, description and category. It runs on the backend and is triggered by the button or Enter. Blank search is blocked, there's a 100-character max, and the empty state is explicit.
- **Product page**: shows the image, title, category, price (USD), rating, description and the Enquire button. Unknown id → 404 page.
- **Enquiry**:
  - It covers one product. The brief's plural "products they want" is handled by one enquiry per product, and a multi-product enquiry list is a next step.
  - Contact details are name + email (required) and phone + message (optional).
  - No confirmation email goes to the customer, so the form can't be used as a spam relay to third parties; that's noted as a next step once there's verification.
  - The email is synchronous in the PoC, and on failure the user sees an error, not "Thank you".
  - Enquiries aren't persisted (no DB in scope); this is noted as a risk and a next step.
  - There's no CAPTCHA (it would need a third-party account). Rate limit + honeypot + Origin check instead.
- **General**: anonymous users (no auth, therefore no cookies and no session-based CSRF surface), USD only, English only, desktop + mobile responsive, product images hotlinked from Fake Store over HTTPS.

## 9. Definition of done
- [ ] `cp .env.example .env && docker compose up --build` works on a clean machine, and all 5 acceptance criteria can be checked by hand in the browser, with the enquiry email visible in Mailpit.
- [ ] No request from the browser goes to fakestoreapi.com, apart from product image URLs (verify in the network tab and note it in DECISIONS.md).
- [ ] The browser console shows **no CSP violations**, and the response headers include CSP, nosniff, frame-ancestors/X-Frame-Options and Referrer-Policy.
- [ ] A 6th enquiry within a minute returns 429 and the UI handles it gracefully. A cross-origin or non-JSON POST is rejected.
- [ ] Errors never expose stack traces, and the logs contain no customer PII.
- [ ] `npm test`, lint, typecheck, `npm audit --audit-level=high` and the secret scan pass locally and in CI, and no test touches the network.
- [ ] Containers run as non-root, and no secrets are in git or the images. `.env.example` documents every variable.
- [ ] README, DECISIONS.md, SECURITY.md, the ADRs, the AI_USAGE.md template, CLAUDE.md, docs/SPEC.md and docs/PR_DESCRIPTION.md all exist.
- [ ] Finally, give me a short review checklist of the files I should read most carefully before the interview (especially the security middleware, the error handler, the enquiry service and the cache), and anything you're unsure about.
