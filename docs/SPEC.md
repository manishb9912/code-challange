# Product Catalogue PoC: Specification

Status: approved before implementation (2026-11-05). This is the plan the build follows; deviations are logged in [ai-notes.md](ai-notes.md) and [DECISIONS.md](../DECISIONS.md).

Verified upstream facts (live fetch of fakestoreapi.com): 20 products shaped `{ id: number, title, price: number, description, category, image, rating: { rate, count } }`; categories `electronics`, `jewelery`, `men's clothing`, `women's clothing`; images at `https://fakestoreapi.com/img/*`; some titles carry trailing spaces (trimmed by the mapper).

## 1. Architecture

```
Browser ──HTTP──▶ nginx (web :8080) ──/api proxy──▶ Fastify API (:3000) ──HTTPS──▶ fakestoreapi.com
  │ static build, CSP headers                         │
  └─ <img> only ─▶ fakestoreapi.com/img (allowlisted) └─SMTP─▶ Mailpit (:1025, UI :8025)

API internals (dependency arrows point inward):
 http/ (routes, plugins, schemas) ──▶ services/ ──▶ ports/ ◀── adapters/ (fakestore, smtp, memory-cache)
                                         └──▶ domain/ (pure)     ▲
 app.ts (composition root) wires adapters ─────────────────────────┘
 packages/shared: Product/Category/Page types + zod schemas, used by api AND web
```

- The ports are `ProductSource`, `Cache`, `Mailer` and `FeaturedProductsProvider`.
- `CachedProductSource` is a decorator that wraps `FakeStoreProductSource` and adds TTL, single-flight and serve-stale-on-error.
- ESLint `import-x/no-restricted-paths` enforces the dependency rule exactly as written in CLAUDE.md.

## 2. API contract (`/api/v1`, JSON, error envelope `{error:{code,message,details?,requestId}}`)

| Method | Path                                    | 2xx                                                      | Errors                                                          |
| ------ | --------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| GET    | /health                                 | 200 `{status:'ok'}`                                      | —                                                               |
| GET    | /ready                                  | 200                                                      | 503 if the upstream is unreachable and the cache is cold        |
| GET    | /products/featured                      | `Product[]` (≤5, in config order)                        | 503                                                             |
| GET    | /categories                             | `Category[]`                                             | 503                                                             |
| GET    | /categories/:slug/products?limit&offset | `{category, topRated: Product[], others: Page<Product>}` | 400 bad slug, 404, 503                                          |
| GET    | /products?q&limit&offset                | `Page<Product>`                                          | 400 missing/blank/>100 q, limit>100                             |
| GET    | /products/:id                           | `Product`                                                | 400 bad id, 404, 503                                            |
| POST   | /enquiries                              | 201 `{id}`                                               | 400 (field details), 403 origin, 413, 415, 429, 502 mail failed |

- Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UPSTREAM_UNAVAILABLE`, `MAIL_DELIVERY_FAILED`, `RATE_LIMITED`, `FORBIDDEN_ORIGIN`, `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `INTERNAL`.
- `Page<T>`: default limit 24, max 100.
- GET product/category responses send `Cache-Control: public, max-age=60, stale-while-revalidate=300` plus an ETag (`@fastify/etag`). Everything else sends `no-store`.
- Schemas come from zod via `fastify-type-provider-zod`, and the OpenAPI docs via `@fastify/swagger` + `@fastify/swagger-ui`.

## 3. Acceptance criterion → endpoint → component → test

| AC       | Endpoint                                    | Web                                                      | API test                                                                                                           | Web test                                                                                       |
| -------- | ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Home     | GET /products/featured                      | `features/home/HomePage`                                 | featured.route.test: "returns the 5 chosen products in configured order; skips unknown ids"                        | "home page shows the 5 featured products"                                                      |
| Category | GET /categories, /categories/:slug/products | `layout/CategoryNav`, `features/category/CategoryPage`   | category.route.test + topRated.test                                                                                | "clicking a category shows top rated and additional products"                                  |
| Search   | GET /products?q=                            | `layout/SearchForm`, `features/search/SearchPage`        | search.test (pure, incl. `.*+?` literal) + products.route.test                                                     | "search shows only matching products" / "shows empty state"                                    |
| Product  | GET /products/:id                           | `components/ProductTile`, `features/product/ProductPage` | products.route.test (200/404/400)                                                                                  | "clicking a tile shows the product details page"                                               |
| Enquiry  | POST /enquiries                             | `features/enquiry/EnquiryPage`                           | enquiry.route.test: email sent to SALES_INBOX with server-side product data, Reply-To, escaped HTML; 502; honeypot | "submitting shows Thank you"; "server error / 429 keeps form values"; "validation errors show" |

## 4. Threat model summary

- **Assets**: the sales inbox and sender reputation, customer PII in transit, API availability, our upstream quota, and SMTP credentials (in prod).
- **Entry points**: every public GET (params/query), `POST /enquiries` (body), the upstream responses (untrusted third party), and env config.

| Threat                 | Mitigation                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Form spam / email cost | Strict rate limit (5/min per IP; the hourly cap moved to the edge (WAF), see DECISIONS.md), honeypot, Origin check, no customer copy (no relay) |
| XSS (UI + email)       | React escaping, `react/no-danger`, strict CSP (nginx + helmet), `escapeHtml` in the email + plain-text part, https/allowlisted image URLs       |
| Header injection       | CR/LF rejected in name/email, subject stripped, nodemailer address objects                                                                      |
| SSRF / path injection  | `:id`/`:slug` pattern `^[A-Za-z0-9_-]{1,64}$`, `encodeURIComponent`, fixed https base URL from config                                           |
| ReDoS                  | No RegExp built from input; `includes` matching; anchored simple regexes only                                                                   |
| Prototype pollution    | `.strict()` zod, Fastify `onProtoPoisoning:'error'`                                                                                             |
| CSRF                   | No cookies/sessions; 415 non-JSON; 403 Origin not allowlisted                                                                                   |
| DoS                    | Global rate limit, 10 KB body, timeouts, length caps, single-flight cache, `p-limit(5)` on upstream                                             |
| Info leakage           | Central error handler (generic message + requestId), pino redaction                                                                             |
| MITM                   | HTTPS upstream (http rejected in prod), TLS never disabled, HSTS in prod, SMTP TLS in prod                                                      |
| Supply chain / secrets | Lockfile, `npm ci`, audit, Dependabot, gitleaks, `.env` gitignored, non-root containers                                                         |

## 5. Assumptions

I'll use the §8 list from the brief verbatim; it goes into DECISIONS.md. Additions:

- Featured defaults in `.env.example`: `FEATURED_PRODUCT_IDS=1,5,9,14,18` (any 5; the order is preserved).
- A missing `Origin` header on POST is **rejected** (403), because browsers always send Origin on a POST. curl users must pass `-H Origin`. This is documented in the README.
- The image placeholder is a static `/placeholder.svg` served by the web app (same-origin, allowed by the CSP).
- The enquiry id is `crypto.randomUUID()`. It appears in the email and the logs (no PII) for traceability.

## 6. Deviations from / refinements of the brief (approved)

1. **No `@fastify/cors`.** Both Docker (nginx proxy) and dev (Vite proxy) are same-origin, so the browser's default same-origin policy is the strictest CORS setting there is. Adding the plugin would only open things up. The Origin check stays. The seam is documented: register `@fastify/cors` with `ALLOWED_ORIGINS` if the web app moves to its own domain.
2. **API docs are gated by `API_DOCS_ENABLED`** (default `false`; `true` in `.env.example` so the reviewer sees `/api/v1/docs`). The brief says "dev only", but in Docker `NODE_ENV=production`. Swagger UI needs inline assets, so it uses `@fastify/swagger-ui`'s `staticCSP`. The CSP on the docs route only is relaxed, and only when docs are enabled; this is recorded in SECURITY.md.
3. **Brotli dropped in nginx.** The stock nginx image has no brotli module. I'll use gzip and document that brotli belongs at CloudFront. I'm not adding a custom nginx build.
4. **Rate-limit "store behind an interface"**: `@fastify/rate-limit` already accepts a store/`redis` option, so I use that seam rather than write my own interface. The hourly enquiry cap uses a second `fastify.rateLimit()` hook on the same route.
5. **Web image**: `nginxinc/nginx-unprivileged` (non-root, listens on 8080) with compose `read_only: true` plus a tmpfs for `/tmp` and `/var/cache/nginx`. API: `node:22-alpine`, `USER node`, `read_only: true`, and a `HEALTHCHECK` via busybox `wget`.
6. **Secret scan**: gitleaks runs in CI (`gitleaks/gitleaks-action`; free for personal repos) and can run locally through its Docker image once Docker is installed.
7. **Time-box honesty**: this scope will almost certainly exceed the brief's 2–3 hours. I won't cut security or tests to hide that. The optional Playwright smoke test is **cut**, and DECISIONS.md will say so. You record the real time in AI_USAGE.md.
8. **Local Node is v24**, and the target is Node 22 (`engines: >=22`; Docker/CI use 22). This is noted in ai-notes.

## 7. Open questions (for the entrepreneur; recorded in DECISIONS.md)

- What is the exact privacy/consent wording under the form?
- Who maintains the featured list going forward? (This drives when an admin UI is needed.)
- Should the customer get a confirmation email once there's verification?
- Should one enquiry be able to cover multiple products?
- What is the real sales inbox address and sending domain (needed for SES domain verification/DKIM)?

---

## 8. Build order (one conventional commit per slice; after each: `npm run lint && npm run typecheck && npm test`, fix failures before moving on)

0. **Repo setup**:
   - Rename `master`→`main`.
   - `.gitignore` (`.env`, `node_modules`, `dist`, `coverage`, `*.pdf`).
   - Move the prompt to `docs/prompts/initial-brief.md`.
   - Initial commit on `main`: `chore: initial commit with agent instructions`.
   - Then `git checkout -b feature/product-catalogue-poc`.
1. `chore: scaffold monorepo, tooling, lint rules and CI`:
   - npm workspaces, tsconfig base (strict, `noUncheckedIndexedAccess`), ESLint flat config (import/no-restricted-paths, react/no-danger, no-eval, no-implied-eval, no-restricted-properties for `process.env` outside `config/`), Prettier, Vitest workspace with coverage thresholds.
   - `.github/workflows/ci.yml` (lint, typecheck, test:coverage, audit, gitleaks) and `dependabot.yml`.
   - `docs/SPEC.md`, `docs/ai-notes.md`.
2. `feat(shared): domain types and zod schemas`. Contents: Product, Category, Page, the enquiry schema, pagination query and error envelope. Tests: the enquiry schema (CR/LF, unknown keys, `__proto__`, honeypot).
3. `feat(api): config, error handling and security plugins`. Contents: zod config, typed errors, error handler, request id, pino redaction, helmet/CSP/HSTS, rate limit, origin + content-type guard, body limit/timeouts, health/ready. Security tests: headers, 403, 415, 413, no stack, redaction.
4. `feat(api): product source port, Fake Store adapter and cache`. Contents: the mapper + slug/label map, zod upstream validation, image allowlist, timeout, p-limit, `CachedProductSource` (TTL, single-flight, serve-stale) and the memory cache. Tests: mapper, adapter (mocked fetch: 5xx, timeout, encoding), cache (fake timers).
5. `feat(api): product, category and search endpoints`. Contents: pure `searchProducts`, `topRated`, `paginate`, `CatalogueService` and routes with ETag/Cache-Control. Unit and route tests.
6. `feat(api): featured products`. Contents: `ConfigFeaturedProductsProvider` and the route. Tests.
7. `feat(api): enquiry service and SMTP mailer`. Contents: `escapeHtml`, the email builder, `EnquiryService`, `SmtpMailer`, the strict rate limit, the route and graceful shutdown in `server.ts`. Tests: escaping, Reply-To, server-side data, 502, honeypot, 429.
8. `feat(web): layout, api client, theme and home page`. Contents: tokens in `theme.css`, the router with lazy routes, the ErrorBoundary, the state components, ProductTile, the header (CategoryNav + SearchForm) and the home page. RTL+msw test for Home.
9. `feat(web): category page` + test.
10. `feat(web): search page` + tests (matching results, empty state).
11. `feat(web): product page` + tests (tile navigation, 404, malicious description rendered as literal text).
12. `feat(web): enquiry form` + tests (Thank you, 502/429 keep values, validation).
13. `chore: docker compose, nginx headers and CSP`:
    - **First, check `docker --version`.** If it's still missing, stop and ask you; I won't install it myself.
    - Contents: multi-stage Dockerfiles, `.dockerignore`, nginx.conf (CSP, headers, gzip, immutable assets, `/api` proxy, `server_tokens off`), compose (api, web, mailpit pinned) and `.env.example`.
    - Verify: run `docker compose up --build`, curl the headers, submit an enquiry and check the Mailpit API, send the 6th enquiry and expect 429, then check the CSP.
14. `docs: README, DECISIONS, SECURITY, ADRs, AI_USAGE template, PR description`:
    - ADRs: 0001 monorepo shared schemas, 0002 ports & adapters, 0003 Mailpit local email, 0004 in-memory search, 0005 caching strategy (single-flight + stale), 0006 same-origin via proxy / no CORS.
    - AI_USAGE.md stays a template with `TODO (human)` placeholders.
    - CLAUDE.md gets updated only if the commands change.

`docs/ai-notes.md` gets one line per course change, self-introduced bug or non-obvious choice, throughout.
