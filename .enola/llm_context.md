# Architecture Snapshot

## Repository Map

107 modules, 3687 symbols, grouped by area. Every module is in `facts.jsonl`, or query_facts(kind="module").

| Area | Modules | Symbols | Languages |
|------|---------|---------|-----------|
| `apps` | 87 | 3223 | typescript |
| `packages` | 1 | 247 | typescript |
| `.agents` | 18 | 217 | python, typescript |
| `.playwright-cli` | 1 | 0 | typescript |

Largest modules:
- `apps/cms/src` — 761 symbols (typescript)
- `apps/web/src/modules/products` — 258 symbols (typescript)
- `packages/contract/src` — 247 symbols (typescript)
- `apps/api/src/routers` — 165 symbols (typescript)
- `apps/web/src/modules/pwa` — 165 symbols (typescript)
- `.agents/skills/ui-ux-pro-max/scripts` — 115 symbols (python)
- `apps/web/src/modules/products/product-bottom-sheet` — 92 symbols (typescript)
- `apps/web/src/components/ui/counter` — 78 symbols (typescript)
- `apps/web/src/lib` — 78 symbols (typescript)
- `apps/web/src/components/ui` — 76 symbols (typescript)
- `apps/catalog/src/modules/product` — 75 symbols (typescript)
- `apps/web/src/modules/account/profile-view` — 73 symbols (typescript)
- `apps/web/src/modules/orders` — 61 symbols (typescript)
- `apps/web/src` — 60 symbols (typescript)
- `apps/web/src/components/ui/code-slots` — 59 symbols (typescript)
- `apps/web/src/modules/supply-requests` — 57 symbols (typescript)
- `apps/web/src/modules/products/product-list` — 52 symbols (typescript)
- `apps/cms/src/globals/components` — 49 symbols (typescript)
- `apps/web/src/modules/orders/order-detail` — 43 symbols (typescript)
- `apps/web/src/components/ui/slide-commit` — 41 symbols (typescript)

## Extraction Quality

- Files parsed: **713** / 1749 seen (39 file(s) + 13 directory tree(s) skipped by ignore globs)
- Parse errors: 0

## Architecture Pattern

**Architecture pattern: nextjs** (confidence: 34%)

Recognised nextjs from directory names: 30 of 89 typescript modules classified — 99% of this repository's 90 modules. Of 46 imports between ordered layers, 44 run inward and 2 against it (96% obey the order); the 2 are reported separately below.

Layer mapping:
- module "apps/api/src" maps to layer "api"
- module "apps/api/src/lib" maps to layer "lib"
- module "apps/api/src/routers" maps to layer "api"
- module "apps/api/src/rpc" maps to layer "api"
- module "apps/catalog/src/app" maps to layer "pages"
- module "apps/catalog/src/app/[[...entry]]" maps to layer "pages"
- module "apps/catalog/src/app/api/catalog/browse" maps to layer "pages"
- module "apps/catalog/src/app/health" maps to layer "pages"
- module "apps/catalog/src/app/p/[identifier]" maps to layer "pages"
- module "apps/catalog/src/components" maps to layer "components"
- module "apps/catalog/src/lib" maps to layer "lib"
- module "apps/cms/src/app" maps to layer "pages"
- … and 18 more (query_insights(explainer="layers") for all)

## How to Add a Feature

This code is laid out as **nextjs**. A dependency runs from an outer layer to an inner one, so a feature is built inward:

1. **api, pages** — e.g. `apps/api/src`
2. **components** — e.g. `apps/catalog/src/components`
3. **lib** — e.g. `apps/api/src/lib`

## Entry Points

- **handler**: `apps/api/src.handlePayloadError` (apps/api/src/payload-error.ts)
- **handler**: `apps/api/src/routers.handleLogout` (apps/api/src/routers/router.helpers.ts)
- **handler**: `apps/cms/src/collections/sms-queue.retrySmsEndpoint.handler` (apps/cms/src/collections/sms-queue/_retry-sms.endpoint.ts)
- **handler**: `apps/cms/src/collections/warehouse-stock.reserveWarehouseStock` (apps/cms/src/collections/warehouse-stock/_stock-operations.ts)
- **handler**: `apps/cms/src/endpoints.activityFeedEndpoint.handler` (apps/cms/src/endpoints/activity-feed.endpoint.ts)
- **handler**: `apps/cms/src/endpoints.catalogBrowseEndpoint.handler` (apps/cms/src/endpoints/catalog-browse.endpoint.ts)
- **handler**: `apps/cms/src/endpoints.catalogEndpoint.handler` (apps/cms/src/endpoints/catalog.endpoint.ts)
- **handler**: `apps/cms/src/endpoints.catalogLocationEndpoint.handler` (apps/cms/src/endpoints/catalog-preview.endpoint.ts)
- **handler**: `apps/cms/src/endpoints.catalogPreviewEndpoint.handler` (apps/cms/src/endpoints/catalog-preview.endpoint.ts)
- **handler**: `apps/cms/src/endpoints.planBrowseEndpoint.handler` (apps/cms/src/endpoints/catalog-browse.endpoint.ts)
- **handler**: `apps/cms/src/mcp.mcpUploadEndpoint.handler` (apps/cms/src/mcp/transfers.ts)
- **handler**: `apps/web/src/lib.setAuthErrorHandler` (apps/web/src/lib/api-client.ts)
- **handler**: `apps/web/src/lib.setQueryAuthErrorHandler` (apps/web/src/lib/query-client.ts)
- **main**: `.agents/skills/ui-ux-pro-max/scripts/validate_data.main` (.agents/skills/ui-ux-pro-max/scripts/validate_data.py)
36 routes, 15 shown:
- **route** ALL `/api/[...slug]` (apps/cms/src/app/(payload)/api/[...slug]/route.ts)
- **route** ALL `/api/openapi/*` (apps/api/src/server.ts)
- **route** ALL `/api/openapi` (apps/api/src/server.ts)
- **route** ALL `/api/rpc/*` (apps/api/src/server.ts)
- **route** ALL `/api/rpc` (apps/api/src/server.ts)
- **route** GET `/[[...entry]]` (apps/catalog/src/app/[[...entry]]/page.tsx)
- **route** GET `/` (apps/catalog/src/app/error.tsx)
- **route** GET `/` (apps/catalog/src/app/layout.tsx)
- **route** GET `/` (apps/cms/src/app/(payload)/layout.tsx)
- **route** GET `/` (apps/cms/src/app/page.tsx)
- **route** GET `/activity-feed` (apps/api/src/routers/activity-feed.ts)
- **route** GET `/admin/[[...segments]]` (apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx)
- **route** GET `/api/auth/me` (apps/api/src/server.ts)
- **route** GET `/api/health` (apps/api/src/server.ts)
- **route** GET `/api/media/*` (apps/api/src/server.ts)
- … and 21 more (query_facts(kind="route") for all)

## Routes

| Method | Path | File | Type |
|--------|------|------|------|
| GET | `/` | `apps/catalog/src/app/error.tsx` | error |
| GET | `/` | `apps/catalog/src/app/layout.tsx` | layout |
| GET | `/` | `apps/cms/src/app/(payload)/layout.tsx` | layout |
| GET | `/` | `apps/cms/src/app/page.tsx` | page |
| GET | `/[[...entry]]` | `apps/catalog/src/app/[[...entry]]/page.tsx` | page |
| GET | `/activity-feed` | `apps/api/src/routers/activity-feed.ts` |  |
| GET | `/admin/[[...segments]]` | `apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx` | page |
| ALL | `/api/[...slug]` | `apps/cms/src/app/(payload)/api/[...slug]/route.ts` | route |
| GET | `/api/auth/me` | `apps/api/src/server.ts` |  |
| POST | `/api/catalog/browse` | `apps/catalog/src/app/api/catalog/browse/route.ts` | route |
| POST | `/api/catalog/browse` | `apps/catalog/src/lib/catalog-client.ts` |  |
| GET | `/api/health` | `apps/api/src/server.ts` |  |
| POST | `/api/media` | `apps/api/src/server.ts` |  |
| POST | `/api/media` | `apps/api/src/server.ts` |  |
| GET | `/api/media/*` | `apps/api/src/server.ts` |  |
| POST | `/api/media/upload` | `apps/api/src/server.ts` |  |
| POST | `/api/media/upload` | `apps/web/src/modules/account/profile-view/_use-profile-documents.ts` |  |
| ALL | `/api/openapi` | `apps/api/src/server.ts` |  |
| ALL | `/api/openapi/*` | `apps/api/src/server.ts` |  |
| GET | `/api/rpc` | `apps/api/src/client.ts` |  |
| ALL | `/api/rpc` | `apps/api/src/server.ts` |  |
| ALL | `/api/rpc/*` | `apps/api/src/server.ts` |  |
| POST | `/api/upload` | `apps/api/src/server.ts` |  |
| POST | `/api/warehouse-stock/${apply` | `apps/cms/src/collections/warehouse-stock/components/stock-import.tsx` |  |
| GET | `/api/warehouses` | `apps/cms/src/collections/warehouse-stock/components/stock-import.tsx` |  |
| POST | `/catalog-browse` | `apps/api/src/routers/catalog-sync.ts` |  |
| GET | `/catalog-location` | `apps/cms/src/globals/components/_catalog-location.tsx` |  |
| POST | `/catalog-preview` | `apps/cms/src/globals/components/catalog-preview.tsx` |  |
| GET | `/categories` | `apps/cms/src/globals/components/_catalog-selection-summary.tsx` |  |
| GET | `/health` | `apps/api/src/server.ts` |  |
| GET | `/health` | `apps/catalog/src/app/health/route.ts` | route |
| GET | `/media/{}` | `apps/cms/src/globals/components/_catalog-media-preview.tsx` |  |
| GET | `/p/[identifier]` | `apps/catalog/src/app/p/[identifier]/page.tsx` | page |
| POST | `/plan-browse` | `apps/api/src/routers/plan.ts` |  |
| POST | `/v1/{}/sms/send.json` | `apps/cms/src/lib/sms.ts` |  |
| POST | `/v1/{}/verify/lookup.json` | `apps/cms/src/modules/sms/kavenegar-client.ts` |  |

## Dependency Rules

92 internal module dependencies. The modules that reach furthest; traverse() or query_facts(kind="dependency") for the edges themselves.

| Module | Depends on |
|--------|------------|
| `apps/cms/src` | 19 modules |
| `apps/cms/src/collections` | 8 modules |
| `apps/web/src/modules` | 8 modules |
| `apps/web/src/modules/cart` | 7 modules |
| `apps/web/src/modules/orders` | 7 modules |
| `apps/web/src/modules/products` | 7 modules |
| `apps/web/src` | 6 modules |
| `apps/web/src/modules/account` | 6 modules |
| `apps/web/src/modules/plans` | 5 modules |
| `apps/cms` | 4 modules |
| `apps/web/src/modules/auth` | 3 modules |
| `apps/api/src` | 2 modules |
| `apps/api` | 1 modules |
| `apps/api/src/rpc` | 1 modules |
| `apps/catalog/src` | 1 modules |
| `apps/catalog/src/app` | 1 modules |
| `apps/catalog/src/app/api/catalog` | 1 modules |
| `apps/catalog/src/app/p` | 1 modules |
| `apps/catalog/src/modules` | 1 modules |
| `apps/cms/src/collections/products` | 1 modules |
| `apps/cms/src/globals` | 1 modules |
| `apps/web/src/components` | 1 modules |

## Critical Modules

| Module | Fan-In | Fan-Out | Criticality |
|--------|--------|---------|-------------|
| `apps/web/src/modules/products` | 13 | 13 | high |
| `apps/cms/src` | 0 | 22 | high |
| `apps/web/src/lib/utils` | 19 | 0 | high |
| `apps/web/src/modules/orders` | 4 | 13 | high |
| `apps/web/src/modules/auth` | 13 | 3 | high |
| `apps/web/src/lib` | 12 | 0 | high |
| `apps/cms/src/lib` | 10 | 0 | high |
| `apps/web/src/components/feedback` | 10 | 0 | high |
| `apps/cms/src/access` | 9 | 0 | medium |
| `apps/web/src/modules/cart` | 2 | 7 | medium |

## Risk Zones

- **Cyclic dependency detected (4 modules)** (confidence: 100%): The 4 modules apps/api/src, apps/api/src/lib, apps/api/src/routers, apps/api/src/rpc depend on each other through more than one cycle. One of them: apps/api/src -> apps/api/src/lib -> apps/api/src. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Cyclic dependency detected (5 modules)** (confidence: 100%): The 5 modules apps/cms/src, apps/cms/src/collections/media, apps/cms/src/collections/users, apps/cms/src/endpoints, apps/cms/src/modules/catalog depend on each other through more than one cycle. One of them: apps/cms/src -> apps/cms/src/collections/media -> apps/cms/src. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Cyclic dependency detected (7 modules)** (confidence: 100%): The 7 modules apps/cms/src/collections/audit-logs, apps/cms/src/collections/orders, apps/cms/src/collections/products, apps/cms/src/collections/warehouse-stock, apps/cms/src/collections/warehouses, apps/cms/src/globals, apps/cms/src/lib depend on each other through more than one cycle. One of them: apps/cms/src/collections/audit-logs -> apps/cms/src/collections/orders -> apps/cms/src/collections/products -> apps/cms/src/collections/audit-logs. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Cyclic dependency detected (11 modules)** (confidence: 100%): 11 modules depend on each other through more than one cycle. One of them: apps/web/src/modules/account -> apps/web/src/modules/account/profile-view -> apps/web/src/modules/account. Their imports are loaded, not resolved lazily, so this is a real cycle and not autoload coupling. It is too large to break in one step; the evidence lists 12 of the 11 modules, and metrics.members in the full output names every one.
- **Cyclic dependency detected (2 modules)** (confidence: 100%): The following modules form a dependency cycle: apps/web/src/modules/plans -> apps/web/src/modules/plans/plan-card -> apps/web/src/modules/plans. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Layer violation: lib -> api (nextjs)** (confidence: 80%): Module "apps/api/src/lib" (layer: lib, level 0) imports module "apps/api/src" (layer: api, level 3). Inner layers should not depend on outer layers.
- **Layer violation: lib -> components (nextjs)** (confidence: 80%): Module "apps/web/src/lib" (layer: lib, level 0) imports module "apps/web/src/components/feedback" (layer: components, level 2). Inner layers should not depend on outer layers.

---

*Generated at 2026-11-19T20:57:41Z in 476.119167ms. 8870 facts, 152 insights.*
