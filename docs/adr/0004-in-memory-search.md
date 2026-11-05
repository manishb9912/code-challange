# 0004: In-memory search and filtering

- Status: accepted (for the PoC)
- Date: 2026-11-05

## Context

Fake Store has no search, filtering or pagination endpoints, and only 20 products.

## Decision

The API loads the product list (cached) and searches, filters and paginates in memory with pure functions:

- `searchProducts`: case-insensitive; every whitespace-separated token must appear in the title, description or category name; title matches rank first. Matching uses `String.includes`, never a RegExp built from user input (no ReDoS, special characters are literal).
- Category "top rated" uses `topRatedByAverage` (top 3 by average rating, tie-broken by review count), behind a swappable `TopRatedStrategy` type.
- `paginate`: `limit`/`offset`, with a default of 24 and a maximum of 100.

The API contract (`GET /products?q=&limit=&offset=` returning `Page<Product>`) is designed so the implementation behind it can change.

## Consequences

- Simple, fast for 20 items, and fully unit-tested.
- **Doesn't scale.** Every search touches the whole list. It also has no stemming, typo tolerance or word boundaries: on real data, "mens cotton" also matches "Womens T Shirt", because "mens" is a substring of "womens".
- The replacement is a `SearchIndex` port backed by OpenSearch or Postgres full-text search, plus a database-backed `ProductSource` that paginates in SQL. Once a database exists, cursor pagination replaces offset. None of this changes the HTTP contract.
