# Architecture Snapshot

## Repository Map

111 modules, 3929 symbols, grouped by area. Every module is in `facts.jsonl`, or query_facts(kind="module").

| Area | Modules | Symbols | Languages |
|------|---------|---------|-----------|
| `apps` | 90 | 3321 | typescript |
| `packages` | 1 | 259 | typescript |
| `.agents` | 18 | 219 | python, typescript |
| `scripts` | 1 | 130 | python |
| `.playwright-cli` | 1 | 0 | typescript |

Largest modules:
- `apps/cms/src` — 778 symbols (typescript)
- `packages/contract/src` — 259 symbols (typescript)
- `apps/web/src/modules/catalog` — 214 symbols (typescript)
- `apps/api/src/routers` — 171 symbols (typescript)
- `apps/web/src/modules/pwa` — 165 symbols (typescript)
- `scripts` — 130 symbols (python)
- `.agents/skills/ui-ux-pro-max/scripts` — 117 symbols (python)
- `apps/web/src/modules/products/product-bottom-sheet` — 101 symbols (typescript)
- `apps/web/src/lib` — 96 symbols (typescript)
- `apps/catalog/src/modules/product` — 83 symbols (typescript)
- `apps/web/src/components/ui/counter` — 78 symbols (typescript)
- `apps/web/src/components/ui` — 76 symbols (typescript)
- `apps/web/src/modules/account/profile-view` — 74 symbols (typescript)
- `apps/web/src/modules/orders` — 67 symbols (typescript)
- `apps/web/src/modules/products` — 63 symbols (typescript)
- `apps/web/src` — 60 symbols (typescript)
- `apps/web/src/components/ui/code-slots` — 59 symbols (typescript)
- `apps/web/src/modules/products/product-list` — 52 symbols (typescript)
- `apps/web/src/modules/supply-requests` — 50 symbols (typescript)
- `apps/cms/src/globals/components` — 49 symbols (typescript)

## Extraction Quality

- Files parsed: **818** / 3024 seen (50 file(s) + 14 directory tree(s) skipped by ignore globs)
- Parse errors: 0

## Architecture Pattern

**Architecture pattern: nextjs** (confidence: 32%)

Recognised nextjs from directory names: 30 of 93 typescript modules classified — 99% of this repository's 94 modules. Of 65 imports between ordered layers, 63 run inward and 2 against it (97% obey the order); the 2 are reported separately below.

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

1. **pages** — e.g. `apps/catalog/src/app`
2. **components** — e.g. `apps/catalog/src/components`
3. **api** — e.g. `apps/api/src`
4. **lib** — e.g. `apps/api/src/lib`

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
- **main**: `scripts.main` (scripts/test_challenger_m1.ts)
- **main**: `scripts/adversarial_challenge_suite.main` (scripts/adversarial_challenge_suite.py)
- **main**: `scripts/catalog_boost_processor.main` (scripts/catalog_boost_processor.py)
- **main**: `scripts/crawl_persepolistile.main` (scripts/crawl_persepolistile.py)
- **main**: `scripts/generate_mapping_and_audit.main` (scripts/generate_mapping_and_audit.py)
35 routes, 15 shown:
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
- … and 20 more (query_facts(kind="route") for all)

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
| POST | `/api/warehouse-stock/{}` | `apps/cms/src/collections/warehouse-stock/components/stock-import.tsx` |  |
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
| POST | `/v1/{}/verify/lookup.json` | `apps/cms/src/modules/sms/kavenegar-client.ts` |  |

## Dependency Rules

106 internal module dependencies. The modules that reach furthest; traverse() or query_facts(kind="dependency") for the edges themselves.

| Module | Depends on |
|--------|------------|
| `apps/cms/src` | 20 modules |
| `apps/web/src/modules` | 9 modules |
| `apps/web/src/modules/products` | 8 modules |
| `apps/cms/src/collections` | 7 modules |
| `apps/web/src/modules/cart` | 7 modules |
| `apps/web/src/modules/orders` | 7 modules |
| `apps/web/src` | 6 modules |
| `apps/web/src/modules/account` | 6 modules |
| `apps/web/src/modules/plans` | 5 modules |
| `apps/web/src/modules/supply-requests` | 5 modules |
| `apps/api/src` | 4 modules |
| `apps/cms` | 4 modules |
| `apps/web/src/modules/auth` | 3 modules |
| `apps/cms/src/globals` | 2 modules |
| `apps/cms/src/modules` | 2 modules |
| `apps/web/src/modules/catalog` | 2 modules |
| `apps/api` | 1 modules |
| `apps/api/src/rpc` | 1 modules |
| `apps/catalog/src` | 1 modules |
| `apps/catalog/src/app` | 1 modules |
| `apps/catalog/src/app/api/catalog` | 1 modules |
| `apps/catalog/src/app/p` | 1 modules |
| `apps/catalog/src/modules` | 1 modules |
| `apps/cms/src/collections/products` | 1 modules |
| `apps/web/src/components` | 1 modules |

## Critical Modules

| Module | Fan-In | Fan-Out | Criticality |
|--------|--------|---------|-------------|
| `apps/cms/src` | 0 | 22 | high |
| `apps/web/src/lib/utils` | 21 | 0 | high |
| `apps/web/src/modules/auth` | 14 | 3 | high |
| `apps/web/src/modules/orders` | 4 | 13 | high |
| `apps/web/src/lib` | 15 | 0 | high |
| `apps/web/src/modules/catalog` | 13 | 2 | high |
| `apps/cms/src/lib` | 13 | 0 | high |
| `apps/web/src/modules/products` | 1 | 12 | high |
| `apps/web/src/components/feedback` | 10 | 0 | high |
| `apps/web/src/modules/pwa` | 10 | 0 | high |

## Risk Zones

- **Cyclic dependency detected (3 modules)** (confidence: 100%): The 3 modules apps/api/src, apps/api/src/routers, apps/api/src/rpc depend on each other through more than one cycle. One of them: apps/api/src -> apps/api/src/routers -> apps/api/src. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Cyclic dependency detected (2 modules)** (confidence: 100%): The following modules form a dependency cycle: apps/web/src/modules/account -> apps/web/src/modules/account/profile-view -> apps/web/src/modules/account. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Cyclic dependency detected (2 modules)** (confidence: 100%): The following modules form a dependency cycle: apps/web/src/modules/auth -> apps/web/src/modules/auth/login-card -> apps/web/src/modules/auth. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Cyclic dependency detected (2 modules)** (confidence: 100%): The following modules form a dependency cycle: apps/web/src/modules/supply-requests -> apps/web/src/modules/supply-requests/supply-request-form -> apps/web/src/modules/supply-requests. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Layer violation: lib -> api (nextjs)** (confidence: 80%): Module "apps/web/src/lib" (layer: lib, level 0) imports module "apps/api/src" (layer: api, level 1). Inner layers should not depend on outer layers.

---

*Generated at 2026-11-24T12:12:12Z in 2.517680916s. 10338 facts, 127 insights.*
