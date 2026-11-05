# 0002: Ports and adapters in the API (kept light)

- Status: accepted
- Date: 2026-11-05

## Context

The brief says the product data source and the email provider will change. The PoC must not hard-wire Fake Store or SMTP into business logic or route handlers.

## Decision

- `domain/` holds pure functions and typed errors: search, top-rated, pagination, the email builder and HTML escaping.
- `ports/` holds interfaces: `ProductSource`, `Cache`, `Mailer`, `FeaturedProductsProvider` and `Logger`.
- `adapters/` holds the implementations: `FakeStoreProductSource`, `CachedProductSource` (a decorator), `MemoryCache`, `SmtpMailer` and `ConfigFeaturedProductsProvider`.
- `services/` holds the use cases (`CatalogueService`, `EnquiryService`), which depend only on ports and domain.
- `http/` holds routes and plugins, which depend on services, never adapters.
- `app.ts` is the only composition root. Tests pass fakes through `buildApp({ config, adapters })`.

ESLint enforces the dependency rule (`import-x/no-restricted-paths`). Fake Store's field names never leave `adapters/fakestore/`.

## Consequences

- Swapping the data source means writing one new `ProductSource` adapter and changing one line in `app.ts`. The API contract and the UI don't change.
- Swapping email (e.g. the SES SDK, or a queue) means writing one new `Mailer` adapter.
- Route tests run the real HTTP stack with in-memory fakes, so no network is needed.
- The cost is a few small interface files. They're kept deliberately minimal (no DI container, no abstract base classes).
