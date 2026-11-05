# CLAUDE.md

Guidance for AI coding agents (Claude Code) working in this repository. Read it fully before making changes. If an instruction here conflicts with a request, stop and ask.

## Project

A product catalogue proof of concept that is meant to grow into the real product, not be thrown away. Customers browse categories, search, view product details and send an enquiry, which is emailed to the sales inbox.

- **Client:** React + TypeScript (Vite), served by nginx.
- **Backend:** Node.js + TypeScript (Fastify).
- **Product data:** the Fake Store API for now, reached **only through the backend**.
- **Expected to change:** the data source, the look and feel, and the email provider. Keep each one behind a boundary.

Priorities, in order: **correctness → security → clarity → testability → features.** Small and explainable beats large and clever. Every line must be defensible by a human in review.

## Commands

Run from the repo root. Keep these scripts working; if you add or rename one, update this section and the README.

```bash
cp .env.example .env                 # first-time setup
docker compose up --build            # full stack: web :8080, api :3000, mailpit UI :8025
npm ci                               # install all workspaces
npm run dev                          # api + web in watch mode (needs mailpit: docker compose up mailpit)
npm run lint                         # ESLint (all workspaces)
npm run typecheck                    # tsc --noEmit (all workspaces)
npm test                             # Vitest (all workspaces), no network
npm run test:coverage                # with coverage thresholds
npm run build                        # production builds
npm test -w apps/api -- search       # run one workspace / filter by name
```

**Before every commit:** `npm run lint && npm run typecheck && npm test` must pass. Never skip, disable or `.only` tests, or add `eslint-disable`, to get green. Fix the cause.

## Repository layout

```
apps/api/src/
  config/      zod-validated env config — the ONLY place that reads process.env
  domain/      pure logic + typed errors (search matcher, top-rated strategy). No I/O, no framework imports
  ports/       interfaces: ProductSource, Mailer, FeaturedProductsProvider, Cache
  adapters/    fakestore/, smtp/, memory-cache/ — implement ports, contain all third-party specifics
  services/    CatalogueService, EnquiryService — orchestrate via ports only
  http/        routes, plugins (helmet, rate-limit, origin check, error handler), request/response schemas
  app.ts       buildApp(deps) — composition root; the only file that knows concrete adapters
  server.ts    process entry: listen + graceful shutdown
apps/web/src/
  api/         typed API client (the only place that calls fetch)
  features/    home/ category/ search/ product/ enquiry/ — one folder per feature
  components/  shared UI (ProductTile, states, ErrorBoundary)
  layout/      header, category nav, search form
  styles/      theme.css — design tokens (CSS custom properties)
packages/shared/  domain types + zod schemas shared by api and web (single source of truth)
docs/          SPEC.md, adr/, ai-notes.md, PR_DESCRIPTION.md
```

### Dependency rule (enforced by ESLint `import/no-restricted-paths`)
- `domain` imports nothing internal except `packages/shared`.
- `services` import `domain` and `ports` only.
- `adapters` import `ports` and `domain`.
- `http` imports `services`, `domain` and `shared`, **never adapters**.
- Only `app.ts` wires concrete adapters.
- In web, components never call `fetch`; they go through `src/api` via TanStack Query hooks.

## Architecture rules

1. **Our domain model is not Fake Store's.** The `Product`/`Category` types live in `packages/shared`. Fake Store field names (`rating.rate`, numeric ids, `jewelery`, `men's clothing`) must never leave `adapters/fakestore/`. Ids are strings, and category slugs are URL-safe.
2. **The client never talks to Fake Store.** All product data goes through `/api/v1`. The only allowed exception is product image URLs, which are validated as https from an allowlisted host.
3. **Validate external data at the edge.** Validate requests with the shared zod schemas (`.strict()`, unknown keys rejected), and validate upstream responses with zod in the adapter.
4. **Contracts live once.** If you change a field, change the zod schema in `packages/shared`; the types, API validation, form validation and OpenAPI all follow. Don't duplicate shapes.
5. **API conventions:**
   - Versioned under `/api/v1`, JSON only.
   - Errors always use `{ error: { code, message, details?, requestId } }`. Throw typed domain errors (`NotFoundError`, `ValidationError`, `UpstreamUnavailableError`, `MailDeliveryError`) and let the central error handler map them. No ad-hoc status handling in routes.
   - Lists return `Page<T> = { items, total, limit, offset }`, with a default limit of 24 and a max of 100.
   - Every route declares params, query, body and response schemas.
6. **Never trust the client for business data.** The enquiry email uses product data looked up server-side by `productId`.
7. **Never show success that didn't happen.** If the email send fails, return 502 and the UI shows an error. "Thank you" appears only after a 201.
8. **Stateless API.** Any in-process state (cache, rate-limit counters) sits behind an interface with a documented shared-store (Redis) replacement.
9. **Cache behaviour** (`CachedProductSource`): TTL from config, single-flight on misses, and serve-stale on upstream error. Keep these behaviours tested.
10. **Config** comes only from `config/`, typed, validated at startup and failing fast. Never log secret values. Every new env var goes into `.env.example` and the README.

## Security non-negotiables

Changes that weaken any of these need explicit human approval and an entry in SECURITY.md.

- **XSS**: no `dangerouslySetInnerHTML` (`react/no-danger` is an error). Render upstream text as text. HTML-escape all user input in email templates, and always send a plain-text part too. Don't loosen the CSP (no `unsafe-inline` or `unsafe-eval`, and no new hosts without a reason).
- **Injection**:
  - No `eval`, `new Function`, `child_process` or dynamic `require`.
  - Never build a `RegExp` from user input; use `includes`.
  - Validate `:id` and `:slug` against `^[A-Za-z0-9_-]{1,64}$` before use. Build upstream URLs with `encodeURIComponent` against the configured base URL.
  - Strip or reject CR/LF in anything that ends up in an email header.
  - When a database is added: **parameterised queries / ORM only**, never string-built SQL.
- **CSRF**: the API uses no cookies and no sessions. State-changing routes require `Content-Type: application/json` (otherwise 415) and an `Origin` in `ALLOWED_ORIGINS` (otherwise 403). CORS is never `*` with credentials. If cookies or auth are introduced, add `SameSite`/`Secure`/`HttpOnly` cookies and CSRF tokens.
- **Transport**: the upstream is HTTPS only. **Never disable TLS verification** (`NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized: false`). HSTS is on in production. SMTP uses TLS in production. `trustProxy` comes from config only.
- **Rate limiting**: there's a global per-IP limit plus a strict limit on `POST /api/v1/enquiries`. Responses are 429 with `Retry-After`. Upstream concurrency is capped. Body limit 10 KB; query and param lengths capped; request timeouts set.
- **Headers**: helmet/nginx set the CSP, nosniff, `frame-ancestors 'none'`, Referrer-Policy and Permissions-Policy, with `X-Powered-By` and nginx `server_tokens` off.
- **Errors and logs**: never return stack traces or upstream error bodies to clients. Logs are structured and redact `name`, `email`, `phone`, `message`, `authorization`, `cookie` and `SMTP_PASS`. **No PII in logs, ever.**
- **Secrets**: never commit `.env`, keys or credentials, or bake them into images. Use `.env.example` with dummy values only.
- **Dependencies**: add as few as possible, pin versions, commit the lockfile, and justify any new dependency in the commit message. CI runs `npm audit --audit-level=high` and a secret scan.
- **Containers**: multi-stage builds, run as non-root, production dependencies only, and `.dockerignore` excludes `.env`, `.git` and `node_modules`.

## Frontend conventions

- Use TanStack Query for server state; no global state library. Use React Router with lazy-loaded routes and a top-level error boundary.
- Every data view handles **loading, error (with retry) and empty** states.
- **Styling** uses CSS Modules that only reference tokens from `styles/theme.css`, with no hard-coded colours, spacing or fonts. A reskin must be a token change, so don't add a UI component library.
- Accessibility (target WCAG 2.1 AA): semantic HTML, labelled inputs, visible focus, alt text on images, and don't rely on colour alone.
- Forms use react-hook-form + zodResolver with the shared schema. Disable submit while pending, and keep what the user typed on error.
- Search state lives in the URL (`/search?q=`). Submit on the button and on Enter. Blank input can't be submitted.
- Format prices with `Intl.NumberFormat`. Images get `loading="lazy"` and explicit dimensions.

## Testing rules

- **Tests never hit the network**: no real Fake Store and no real SMTP. Use fake `ProductSource`/`Mailer` implementations, msw, or undici `MockAgent`.
- Backend route tests use `buildApp({ fakes })` + `app.inject()`. Frontend tests use React Testing Library + msw, testing behaviour rather than implementation details.
- **Each acceptance criterion has at least one test whose name reads like the criterion.**
- Every bug fix comes with a test that fails without the fix.
- Security controls have tests: 429, 415, 403, the headers, no stack traces, escaped email HTML, log redaction, the body limit (413), and literal handling of special characters in search.
- Use fake timers for TTL and cache tests. No sleeps or flaky timing.
- Coverage thresholds (`domain/` and `services/` ≥ 80% lines) must not be lowered to pass.

## Code style

- Strict TypeScript. No `any` without a one-line justification comment, and no non-null `!` assertions on external data.
- Small, single-purpose functions and files, with descriptive names. Comments explain *why*, not *what*.
- No dead code, commented-out code, stray `console.log` or unresolved TODOs. A TODO carries a reason and lives in DECISIONS.md's "Next steps".
- Use async/await everywhere, and always handle rejected promises.
- Prettier formatting and ESLint clean.

## Workflow for agents

1. **Plan before code** for anything non-trivial. State the approach, the files touched and the tests to add, then wait for approval if the change is significant or ambiguous.
2. **Work in small vertical slices** with one logical change per commit, using conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
3. **Stay in scope.** Don't add auth, a cart, a database, Redis, an admin UI, i18n, SSR or IaC unless asked. Design the seam and record it in DECISIONS.md instead.
4. **Ask, don't guess**, when requirements are unclear, reality differs from the docs (e.g. the upstream shape), or a security control would block a feature. Propose options.
5. **Record notable moments** in `docs/ai-notes.md`, one line each: course changes, mistakes you made and fixed, non-obvious choices. Never write or edit `AI_USAGE.md` content marked `TODO (human)`.
6. **Never push, force-push, rewrite history or open PRs.** The human does that.
7. **Keep docs in sync**: update the README (setup, commands, env vars), DECISIONS.md (assumptions, cuts), SECURITY.md (controls) and an ADR in `docs/adr/` for any significant decision.

## Definition of done (every change)

- [ ] Lint, typecheck and tests all pass, and coverage thresholds are met.
- [ ] New behaviour is tested, including the error paths.
- [ ] No new PII in logs, no secrets, and no weakened security control.
- [ ] Boundaries are respected (the dependency rule; no Fake Store shapes outside the adapter).
- [ ] Docs and `.env.example` are updated where relevant.
- [ ] `docker compose up --build` still works from a clean checkout.
