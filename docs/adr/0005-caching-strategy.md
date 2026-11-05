# 0005: Caching: decorator with TTL, single-flight and serve-stale

- Status: accepted
- Date: 2026-11-05

## Context

Fake Store is a free third-party service with unknown availability and rate limits. User traffic must not fan out to it, and a short upstream outage shouldn't take the catalogue down.

## Decision

Caching happens in layers:

1. **Browser**: TanStack Query cache (`staleTime` 60 s).
2. **HTTP**: catalogue GETs send `Cache-Control: public, max-age=60, stale-while-revalidate=300` and an `ETag` (304 on match), so a CDN (CloudFront) can absorb read traffic. Errors, enquiries and probes send `no-store`.
3. **API**: `CachedProductSource` wraps any `ProductSource`:
   - TTL from `CACHE_TTL_SECONDS` (default 300 s);
   - **single-flight**: concurrent misses for a key share one upstream call (no stampede);
   - **serve-stale-on-error**: entries are kept for 12× the TTL, and if the upstream throws `UpstreamUnavailableError`, the last good value is served with a warning log;
   - **negative caching** for unknown product ids, so repeated bad ids don't reach the upstream;
   - only upstream-unavailable errors fall back to stale data, so programming errors are never masked.
4. **Upstream protection**: `p-limit` caps concurrent upstream requests (`UPSTREAM_MAX_CONCURRENCY`, default 5), with a 5 s timeout.

The `Cache` port has an in-memory adapter bounded to 1,000 entries (oldest evicted).

## Consequences

- Cold start plus an upstream outage gives 503, and `/ready` reports not-ready.
- The in-memory cache is per instance. With several API instances, use a Redis/ElastiCache `Cache` adapter. Single-flight then only coalesces within an instance, which is acceptable; a distributed lock is unnecessary at this scale.
- Data can be up to TTL + CDN max-age stale. That's fine for a catalogue, and prices in enquiry emails are always looked up server-side at send time (through the same cache).
