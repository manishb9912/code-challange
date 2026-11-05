# 0006: Same-origin API via a reverse proxy, no CORS

- Status: accepted
- Date: 2026-11-05

## Context

The browser needs to call the API. Enabling CORS means maintaining an allowlist and reasoning about preflights and credentials. Same-origin removes that surface entirely.

## Decision

- The web app is served by nginx, which proxies `/api/` to the API container. The Vite dev server proxies `/api` the same way. The browser only ever talks to one origin.
- The API does **not** register a CORS plugin. Without CORS headers, browsers block cross-origin reads by default, which is the strictest setting available.
- State-changing routes still check that `Origin` is in `ALLOWED_ORIGINS` (403 otherwise) and require `Content-Type: application/json` (415 otherwise), as CSRF defence in depth.
- nginx overwrites `X-Forwarded-For` with the client address, and the API trusts exactly one proxy hop (`TRUST_PROXY_HOPS=1`). Per-IP rate limits therefore see the real client and can't be spoofed through that header.

## Consequences

- No CORS configuration to get wrong.
- In production, CloudFront serves the S3 site and routes `/api/*` to the ALB, keeping the same single origin.
- If the API must later serve another origin (e.g. a mobile web app on a different domain), register `@fastify/cors` with an explicit `ALLOWED_ORIGINS` list and never `*` with credentials.
- `ALLOWED_ORIGINS` must contain the origin the browser actually uses, including the port (e.g. `WEB_PORT`).
