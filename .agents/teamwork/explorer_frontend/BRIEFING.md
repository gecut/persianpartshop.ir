# BRIEFING — 2026-11-10T13:31:00Z

## Mission
Analyze apps/web and packages/contract for client-side concurrency, bundle performance, React 19 architecture, architectural compliance, contract integrity, Persian RTL rules, and technical debt catalogue.

## 🔒 My Identity
- Archetype: explorer
- Roles: frontend, shared contracts & client performance explorer
- Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_frontend
- Original parent: d9727e7d-d864-4b61-a8fc-1a1433c1459a
- Milestone: Investigation & Analysis Complete

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Only write metadata, reports, and handoffs in working directory
- Ground all observations in concrete file paths, function names, and code lines
- Write comprehensive analysis.md and 5-component handoff.md
- Technical debt catalogue with Title, Severity (High/Medium/Low), Concrete file path & lines, Operational/User Impact, and Remediation

## Current Parent
- Conversation ID: d9727e7d-d864-4b61-a8fc-1a1433c1459a
- Updated: 2026-11-10T13:31:00Z

## Investigation State
- **Explored paths**:
  - `apps/web/src/lib/` (`query-client.ts`, `api-client.ts`, `query-keys.ts`, `write-activity.ts`, `drafts.ts`, `utils/*`)
  - `apps/web/src/routes/` (`__root.tsx`, `account.tsx`, `cart.tsx`, `index.tsx`, `login.tsx`, `orders/*`, `plans.tsx`, `product/*`, `routeTree.gen.ts`)
  - `apps/web/src/modules/` (`products/*`, `cart/*`, `orders/*`, `plans/*`, `auth/*`, `pwa/*`, `supply-requests/*`, `checkout/*`)
  - `packages/contract/src/` (`index.ts`, `catalog.ts`, `auth.ts`, `customer.ts`, `order.ts`, `plan.ts`, `shopping.ts`, `warehouse.ts`, `supply-request.ts`, `activity-feed.ts`, `common.ts`)
  - `apps/web/vite.config.ts`, `apps/web/package.json`, `apps/web/dist/assets/`, `apps/web/index.html`, `apps/web/src/styles/globals.css`
- **Key findings**:
  1. Full lack of React Error Boundaries (`WSOD` vulnerability).
  2. Refetch storm & thundering herd in `catalogCoordinator` + `refetchOnWindowFocus: true` under thousands of active users.
  3. Monolithic bundle (1.49 MB JS + 517 KB CSS) due to missing route lazy loading in TanStack Router and missing Vite manualChunks.
  4. Contract type-safety erosion via `z.any()` in over 40 endpoints across `packages/contract`.
  5. 14 documented technical debts and architectural trade-offs catalogued with remediations.
- **Unexplored areas**: None within the frontend and contract scope.

## Key Decisions Made
- Fully documented all 7 core mission areas with line-by-line evidence.
- Created comprehensive `analysis.md` and 5-component `handoff.md`.
- Maintained strict zero-code modification discipline.

## Artifact Index
- `DISPATCH.md` — Log of initial dispatch instructions
- `BRIEFING.md` — Persistent working memory
- `progress.md` — Heartbeat and task tracker
- `analysis.md` — Full deep-dive analysis report in Persian with technical English terms
- `handoff.md` — 5-component self-contained handoff report
