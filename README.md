# Product Catalogue PoC

A small product catalogue that is meant to grow, not be thrown away. Customers browse categories, search, view product details and send an enquiry, which is emailed to the sales inbox. Product data comes from the [Fake Store API](https://fakestoreapi.com) **through our own backend**; the browser never calls it for data.

- **Web**: React 19 + TypeScript (Vite), served by nginx.
- **API**: Node.js 22 + TypeScript (Fastify 5).
- **Local email**: [Mailpit](https://mailpit.axllent.org/) catches outgoing mail and shows it in a web UI.

Further reading:

- [DECISIONS.md](DECISIONS.md): assumptions, cuts, how it grows, next steps.
- [SECURITY.md](SECURITY.md): threats and controls.
- [docs/adr/](docs/adr/): architecture decision records.
- [docs/SPEC.md](docs/SPEC.md): the plan written before building.
- [AI_USAGE.md](AI_USAGE.md): how AI was used.

## Why this stack

- **React + TypeScript for the client.** It has the widest reach (any browser, desktop and mobile, with no app-store step), and Vite gives the quickest feedback loop while the entrepreneur is still firming up the vision. The look and feel is about to come from a creative agency, so styling is plain CSS Modules driven by design tokens rather than a component library.
- **Node + TypeScript for the backend.** One language end to end means the **same zod schemas** define the API contract, validate requests, validate the form in the browser and generate the OpenAPI docs ([ADR 0001](docs/adr/0001-monorepo-shared-schemas.md)). Fastify is fast and schema-first, and its security plugins (helmet, rate-limit) are mature.

## Quick start (Docker only)

Prerequisites: **Docker** with Compose v2. Node isn't needed to run the stack.

```bash
cp .env.example .env && docker compose up --build
```

The first build takes a few minutes. Then:

| What                            | URL                                 |
| ------------------------------- | ----------------------------------- |
| Web app                         | http://localhost:8080               |
| API health                      | http://localhost:3000/api/v1/health |
| API docs (OpenAPI / Swagger UI) | http://localhost:3000/api/v1/docs   |
| Mailpit (the "sales inbox")     | http://localhost:8025               |

If port 8080 is already in use, set `WEB_PORT` (e.g. `WEB_PORT=8081`) in `.env` **and** add `http://localhost:8081` to `ALLOWED_ORIGINS`. Otherwise enquiry submissions are rejected with 403, which is the CSRF check working as intended.

### Seeing the acceptance criteria

1. **Home**: http://localhost:8080 shows the five products listed in `FEATURED_PRODUCT_IDS`, in that order.
2. **Category**: click a category in the header to see "Top rated" (the top 3 by rating) and "More in …".
3. **Search**: type e.g. `jacket` and press **Search** or Enter. Only matching products are shown.
4. **Product**: click any product tile to open its details page.
5. **Enquiry**: on a product page, click **Enquire**, fill in name and email, and submit. You'll see "Thank you", and the email appears in **Mailpit** at http://localhost:8025. Open it to see the product details (looked up server-side), the customer's message and `Reply-To` set to the customer.

To see the abuse protection, send six enquiries within a minute: the sixth gets a friendly "please wait" message (HTTP 429).

## Environment variables

All configuration is environment-driven and validated at startup; the API refuses to start with a clear message naming any bad variable (values are never printed). `.env.example` contains safe local defaults.

| Variable                        | Default                    | Purpose                                                                                                                                     |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                      | `development`              | `production` additionally requires an https upstream and TLS for SMTP, and enables HSTS. Compose forces `development` (Mailpit has no TLS). |
| `HOST` / `PORT`                 | `0.0.0.0` / `3000`         | API listen address.                                                                                                                         |
| `LOG_LEVEL`                     | `info`                     | pino level (`fatal` … `trace`, `silent`).                                                                                                   |
| `TRUST_PROXY_HOPS`              | `0`                        | Trusted reverse-proxy hops for client IP / protocol. Compose sets `1` (nginx).                                                              |
| `ALLOWED_ORIGINS`               | _(required)_               | Comma-separated origins allowed to POST (CSRF defence), e.g. `http://localhost:8080,http://localhost:5173`.                                 |
| `API_DOCS_ENABLED`              | `false`                    | Serve OpenAPI + Swagger UI at `/api/v1/docs`. `.env.example` sets `true`.                                                                   |
| `FAKESTORE_BASE_URL`            | `https://fakestoreapi.com` | Product source base URL (https required in production).                                                                                     |
| `UPSTREAM_TIMEOUT_MS`           | `5000`                     | Timeout per upstream request.                                                                                                               |
| `UPSTREAM_MAX_CONCURRENCY`      | `5`                        | Maximum concurrent upstream requests.                                                                                                       |
| `IMAGE_HOST_ALLOWLIST`          | `fakestoreapi.com`         | Hosts product images may come from (https only); others become a placeholder.                                                               |
| `CACHE_TTL_SECONDS`             | `300`                      | How long product data is fresh in the API cache.                                                                                            |
| `FEATURED_PRODUCT_IDS`          | _(empty)_                  | The chosen home-page products, in display order (max 5 shown). Example: `1,5,9,14,18`.                                                      |
| `RATE_LIMIT_GLOBAL_PER_MINUTE`  | `100`                      | Per-IP limit on all API routes (health probes exempt).                                                                                      |
| `RATE_LIMIT_ENQUIRY_PER_MINUTE` | `5`                        | Per-IP limit on `POST /api/v1/enquiries`.                                                                                                   |
| `SALES_INBOX`                   | _(required)_               | Where enquiry emails are sent.                                                                                                              |
| `MAIL_FROM`                     | _(required)_               | Sender address.                                                                                                                             |
| `SMTP_HOST` / `SMTP_PORT`       | _(required)_ / `587`       | SMTP server. Locally Mailpit (`localhost:1025`; compose overrides the host to `mailpit`).                                                   |
| `SMTP_SECURE`                   | `false`                    | Implicit TLS (port 465).                                                                                                                    |
| `SMTP_REQUIRE_TLS`              | `false`                    | Require STARTTLS (e.g. SES on 587).                                                                                                         |
| `SMTP_USER` / `SMTP_PASS`       | _(blank)_                  | SMTP credentials; blank for Mailpit. In production these come from Secrets Manager.                                                         |
| `WEB_PORT`                      | `8080`                     | Docker compose only: host port for the web app.                                                                                             |

## Running the tests

Requires Node 22+ (see `.nvmrc`).

```bash
npm ci
npm test               # all workspaces (Vitest); no test touches the network
npm run test:coverage  # with coverage thresholds (api domain/ and services/ >= 80% lines)
npm run lint           # ESLint, including the architecture dependency rule
npm run typecheck
npm run verify         # lint + typecheck + test (the pre-commit gate)
npm test -w apps/api -- search   # one workspace, filtered by name
```

There are 220 tests: API route tests use the real Fastify app with in-memory fakes (`app.inject`); web tests use React Testing Library with msw at the network boundary. Every acceptance criterion has tests named after it, and the security controls (403, 415, 413, 429, headers, no stack traces, escaped email HTML, log redaction, literal search characters) are tested.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs format check, lint, typecheck, tests with coverage, build, `npm audit --audit-level=high`, a gitleaks secret scan and a Docker image build.

## Running without Docker

```bash
npm ci
cp .env.example .env
docker compose up -d mailpit   # or any SMTP catcher on localhost:1025
npm run dev                    # API on :3000 (watch) + web on http://localhost:5173 (Vite proxies /api)
```

## Project structure

```
apps/
  api/                  Fastify backend
    src/
      config/           zod-validated env config (the only reader of process.env)
      domain/           pure logic: search, top-rated, pagination, email builder, escaping, errors
      ports/            interfaces: ProductSource, Cache, Mailer, FeaturedProductsProvider, Logger
      adapters/         fakestore/, smtp/, memory-cache/, cached-product-source, config-featured
      services/         CatalogueService, EnquiryService
      http/             routes, plugins (security, rate limit, errors, cache headers, docs)
      app.ts            composition root: buildApp({ config, adapters })
      server.ts         process entry: listen + graceful shutdown
    test/               route/security tests, fakes and fixtures
    Dockerfile
  web/                  React frontend
    src/
      api/              typed API client (the only fetch caller) + TanStack Query hooks
      components/       ProductTile, ProductGrid, Rating, loading/error/empty states, ErrorBoundary
      features/         home/, category/, search/, product/, enquiry/, not-found/
      layout/           Layout, CategoryNav, SearchForm
      styles/           theme.css (design tokens), global.css, page.module.css
    nginx/              nginx server config + security headers snippet
    Dockerfile
packages/
  shared/               domain types + zod schemas shared by api and web
docs/                   SPEC.md, adr/, ai-notes.md, PR_DESCRIPTION.md
docker-compose.yml      web (nginx), api, mailpit
```

The dependency rule (domain ← services ← http; adapters wired only in `app.ts`) is enforced by ESLint, so `npm run lint` fails if a route imports an adapter or domain code imports I/O.
