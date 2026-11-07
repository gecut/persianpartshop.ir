---
name: bun-hono-integration
description: Use when working on Hono routes, middleware, request handling, or Bun runtime integration in PersianPart's API.
---

# Hono on Bun in PersianPart

## Project boundary

`apps/api` runs Hono on Bun. The API's package scripts are the source for development and checks; use `pnpm --filter @persianpart/api dev`, `pnpm --filter @persianpart/api typecheck`, and `pnpm --filter @persianpart/api test` as appropriate. Dependencies are managed with pnpm, not `bun install`.

The shared API contract belongs in `packages/contract`. Implement contract procedures with oRPC and use Hono for the HTTP/runtime boundary and endpoints that are intentionally outside the RPC contract. Do not duplicate request or response shapes in a Hono route when a shared contract already owns them.

## Existing integration

Before changing `apps/api/src/server.ts`, preserve its current ownership and ordering:

- The Hono app configures logger, JSON formatting, trailing-slash handling, and CORS before routes.
- `/health` and `/api/health` are Hono health endpoints.
- `/api/rpc` and `/api/rpc/*` delegate to the oRPC handler with a per-request context.
- Media upload/serving and the CMS OpenAPI proxy are direct Hono routes.
- Bun's server consumes the exported `fetch` handler.

Inspect the route, middleware order, and context creation before adding middleware or routes. Use `hono/jwt` only in the existing authentication boundary and never copy credentials or fallback secrets into examples, source, logs, or documentation.

## Request and error handling

- Validate untrusted query, path, header, and body input at the boundary. Prefer the canonical contract/schema for shared API shapes; do not treat parsed JSON as trusted or typed without validation.
- Parse request bodies once and keep upload size, file type, path handling, and storage checks explicit for file routes.
- Return explicit HTTP status codes and stable response shapes. Let the existing global error handler own Hono error translation; avoid swallowing errors or returning success after a failed operation.
- Keep logs free of tokens, credentials, raw sensitive payloads, and personal data.

## Runtime and verification

Use Bun-specific APIs only where the API package already relies on Bun or the task requires them. Verify route behavior with an existing test or an actual local HTTP request; typechecking alone does not prove an endpoint is exposed. Run the narrowest relevant package check and report the exact command and result.
