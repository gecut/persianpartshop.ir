# BRIEFING — 2026-11-10T13:27:00Z

## Mission
Comprehensive backend & high-concurrency analysis of apps/api and apps/cms under thousands of concurrent active users, uncovering technical debt, architectural trade-offs, and scalability bottlenecks.

## 🔒 My Identity
- Archetype: explorer
- Roles: Backend & High-Concurrency Explorer
- Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend
- Original parent: d9727e7d-d864-4b61-a8fc-1a1433c1459a
- Milestone: Multi-agent codebase audit & technical debt cataloging

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify any project code
- Only write metadata, reports, and handoff files in /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_backend
- Ground all findings with concrete file paths, line numbers, function names, and verbatim code quotes
- Analyze apps/api (Hono + oRPC on Bun, pg, Payload SDK) and apps/cms (Payload CMS v3 on Next.js + PostgreSQL) under high concurrency assumptions

## Current Parent
- Conversation ID: d9727e7d-d864-4b61-a8fc-1a1433c1459a
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `apps/api/src/server.ts`, `apps/api/src/payload.ts`, `apps/api/src/rpc/*`, `apps/api/src/routers/*`, `apps/api/src/lib/*`
  - `apps/cms/src/payload.config.ts`, `apps/cms/src/collections/*`, `apps/cms/src/endpoints/*`, `apps/cms/src/migrations/*`, `apps/cms/src/lib/*`
  - `packages/contract/src/*`
  - `Dockerfile`, `docker-compose.yml`
- **Key findings**:
  - Unconfigured default 10-connection PostgreSQL pool in `apps/cms/src/payload.config.ts:149-151`.
  - Dual-process hop: `apps/api` proxies all data via HTTP REST calls to Next.js CMS (`@payloadcms/sdk`), doubling latency.
  - Complete absence of distributed caching (no Redis/KeyDB) creating thundering herd vulnerability.
  - In-memory facet filtering & while loops over entire products table (`catalog.ts:179-206`).
  - Monolithic single-transaction batch CSV import locking thousands of products with `FOR UPDATE` (`_import.endpoints.ts:66-76`).
  - Synchronous Kavenegar SMS dispatch blocking HTTP threads, including loops over 100s of recipients in plan hooks (`plans.collection.ts:58-80`).
  - In-memory token revocation Map (`jwt.ts:104-123`) broken across multi-container and restarts.
  - Race condition in OTP brute-force attempt counter (`otp.ts:155-164`).
  - Missing global rate limiting, missing request timeouts, missing graceful shutdown, deceptive health checks.
- **Unexplored areas**: None within backend scope; investigation complete.

## Key Decisions Made
- Cataloged 18 distinct backend technical debts with High/Medium/Low classifications, file paths, impact, and remediations.
- Produced exhaustive report in Persian with technical English terminology in `analysis.md`.

## Artifact Index
- DISPATCH.md — Parent dispatch log
- BRIEFING.md — Persistent working memory and index
- progress.md — Liveness heartbeat and investigation progress
- analysis.md — Full comprehensive technical debt and high-concurrency analysis (18 categorized debts)
- handoff.md — 5-component self-contained handoff report
