# 0001: Monorepo with shared zod schemas

- Status: accepted
- Date: 2026-11-05

## Context

The web app and the API must agree on the product model, the paginated list shape, the error envelope and the enquiry form rules. If those are defined twice, they drift. Typically the form accepts something the API rejects, or a renamed field breaks the UI silently.

## Decision

Use a single npm-workspaces repository with three packages: `apps/api`, `apps/web` and `packages/shared`. `packages/shared` holds the zod schemas, and the TypeScript types are inferred from them. The schemas are used for:

- API request and response validation (via `fastify-type-provider-zod`);
- the generated OpenAPI document;
- web form validation (react-hook-form + `zodResolver`);
- runtime validation of API responses in the web client.

`packages/shared` exposes a `source` export condition, so the api, web, Vitest and tsx consume its TypeScript directly. Production builds use the compiled `dist`.

## Consequences

- A field change happens in one place, and the compiler flags every affected consumer.
- The enquiry rules (lengths, CR/LF rejection, strict keys) are identical in the browser and on the server.
- zod ships in the web bundle (~119 KB gzipped total for the main chunk). `zod/mini` is a possible later optimisation.
- One lockfile and one CI pipeline. The Docker builds need the repository root as their build context.
