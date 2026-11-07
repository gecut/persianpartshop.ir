# Architecture Snapshot

## Repository Map

67 modules, 2091 symbols, grouped by area. Every module is in `facts.jsonl`, or query_facts(kind="module").

| Area | Modules | Symbols | Languages |
|------|---------|---------|-----------|
| `apps` | 47 | 1719 | typescript |
| `.agents` | 18 | 217 | python, typescript |
| `packages` | 1 | 150 | typescript |
| `.github` | 1 | 5 | python |

Largest modules:
- `apps/cms/src` — 591 symbols (typescript)
- `apps/web/src/components/ui` — 303 symbols (typescript)
- `packages/contract/src` — 150 symbols (typescript)
- `.agents/skills/ui-ux-pro-max/scripts` — 115 symbols (python)
- `apps/web/src/types` — 100 symbols (typescript)
- `apps/api/src/routers` — 96 symbols (typescript)
- `apps/web/src/features/products` — 92 symbols (typescript)
- `apps/api/src/lib` — 54 symbols (typescript)
- `apps/web/src` — 50 symbols (typescript)
- `apps/web/src/features/cart` — 42 symbols (typescript)
- `apps/web/src/lib/utils` — 35 symbols (typescript)
- `apps/web/src/features/plans` — 32 symbols (typescript)
- `apps/web/src/features/auth` — 27 symbols (typescript)
- `apps/api/src/rpc` — 24 symbols (typescript)
- `apps/web/src/features/checkout` — 24 symbols (typescript)
- `apps/cms/src/access` — 22 symbols (typescript)
- `apps/web/src/features/orders` — 22 symbols (typescript)
- `apps/web/src/lib` — 22 symbols (typescript)
- `apps/api/src` — 21 symbols (typescript)
- `apps/cms/src/collections/otps` — 18 symbols (typescript)

## Extraction Quality

- Files parsed: **322** / 467 seen (19 file(s) + 10 directory tree(s) skipped by ignore globs)
- Parse errors: 0

## Architecture Pattern

**Architecture pattern: nextjs** (confidence: 38%)

Recognised nextjs from directory names: 18 of 48 typescript modules classified — 96% of this repository's 50 modules. Of 25 imports between ordered layers, 24 run inward and 1 against it (96% obey the order); the 1 are reported separately below.

Layer mapping:
- module "apps/api/src" maps to layer "api"
- module "apps/api/src/lib" maps to layer "lib"
- module "apps/api/src/routers" maps to layer "api"
- module "apps/api/src/rpc" maps to layer "api"
- module "apps/cms/src/app" maps to layer "pages"
- module "apps/cms/src/app/(payload)" maps to layer "pages"
- module "apps/cms/src/app/(payload)/admin" maps to layer "pages"
- module "apps/cms/src/app/(payload)/admin/[[...segments]]" maps to layer "pages"
- module "apps/cms/src/app/(payload)/api/[...slug]" maps to layer "pages"
- module "apps/cms/src/collections/products/components" maps to layer "components"
- module "apps/cms/src/components/admin" maps to layer "components"
- module "apps/web/src/components/feedback" maps to layer "components"
- … and 6 more (query_insights(explainer="layers") for all)

## How to Add a Feature

This code is laid out as **nextjs**. A dependency runs from an outer layer to an inner one, so a feature is built inward:

1. **api, pages** — e.g. `apps/api/src`
2. **components** — e.g. `apps/cms/src/collections/products/components`
3. **hooks** — e.g. `apps/web/src/hooks`
4. **lib, types** — e.g. `apps/api/src/lib`

## Entry Points

- **handler**: `apps/api/src.handlePayloadError` (apps/api/src/payload.ts)
- **handler**: `apps/api/src/routers.handleLogout` (apps/api/src/routers/router.helpers.ts)
- **main**: `.agents/skills/ui-ux-pro-max/scripts/validate_data.main` (.agents/skills/ui-ux-pro-max/scripts/validate_data.py)
- **route** ALL `/api/[...slug]` (apps/cms/src/app/(payload)/api/[...slug]/route.ts)
- **route** ALL `/api/openapi/*` (apps/api/src/server.ts)
- **route** ALL `/api/openapi` (apps/api/src/server.ts)
- **route** ALL `/api/rpc/*` (apps/api/src/server.ts)
- **route** ALL `/api/rpc` (apps/api/src/server.ts)
- **route** GET `/` (apps/cms/src/app/(payload)/layout.tsx)
- **route** GET `/` (apps/cms/src/app/page.tsx)
- **route** GET `/admin/[[...segments]]` (apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx)
- **route** GET `/api/auth/me` (apps/api/src/server.ts)
- **route** GET `/api/health` (apps/api/src/server.ts)
- **route** GET `/api/media/*` (apps/api/src/server.ts)
- **route** GET `/api/rpc` (apps/api/src/client.ts)
- **route** GET `/health` (apps/api/src/server.ts)
- **route** POST `/api/media/upload` (apps/api/src/server.ts)
- **route** POST `/v1/{}/verify/lookup.json` (apps/api/src/lib/kavenegar.ts)

## Routes

| Method | Path | File | Type |
|--------|------|------|------|
| GET | `/` | `apps/cms/src/app/(payload)/layout.tsx` | layout |
| GET | `/` | `apps/cms/src/app/page.tsx` | page |
| GET | `/admin/[[...segments]]` | `apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx` | page |
| ALL | `/api/[...slug]` | `apps/cms/src/app/(payload)/api/[...slug]/route.ts` | route |
| GET | `/api/auth/me` | `apps/api/src/server.ts` |  |
| GET | `/api/health` | `apps/api/src/server.ts` |  |
| GET | `/api/media/*` | `apps/api/src/server.ts` |  |
| POST | `/api/media/upload` | `apps/api/src/server.ts` |  |
| ALL | `/api/openapi` | `apps/api/src/server.ts` |  |
| ALL | `/api/openapi/*` | `apps/api/src/server.ts` |  |
| GET | `/api/rpc` | `apps/api/src/client.ts` |  |
| ALL | `/api/rpc` | `apps/api/src/server.ts` |  |
| ALL | `/api/rpc/*` | `apps/api/src/server.ts` |  |
| GET | `/health` | `apps/api/src/server.ts` |  |
| POST | `/v1/{}/verify/lookup.json` | `apps/api/src/lib/kavenegar.ts` |  |

## Dependency Rules

- `apps/api/src/rpc` -> `apps/api/src/routers`
- `apps/api/src` -> `apps/api/src/lib`
- `apps/api` -> `apps/api/src/rpc`
- `apps/cms/src/collections/products` -> `apps/cms/src/collections/products`
- `apps/cms/src/collections` -> `apps/cms/src/access`
- `apps/cms/src` -> `apps/cms/src/collections/admins`
- `apps/cms/src` -> `apps/cms/src/collections/brands`
- `apps/cms/src` -> `apps/cms/src/collections/categories`
- `apps/cms/src` -> `apps/cms/src/collections/customer-types`
- `apps/cms/src` -> `apps/cms/src/collections/dimensions`
- `apps/cms/src` -> `apps/cms/src/collections/media`
- `apps/cms/src` -> `apps/cms/src/collections/orders`
- `apps/cms/src` -> `apps/cms/src/collections/otps`
- `apps/cms/src` -> `apps/cms/src/collections/plans`
- `apps/cms/src` -> `apps/cms/src/collections/products`
- `apps/cms/src` -> `apps/cms/src/collections/tags`
- `apps/cms/src` -> `apps/cms/src/collections/users`
- `apps/web/src/components` -> `apps/web/src/features/auth`
- `apps/web/src/components` -> `apps/web/src/hooks`
- `apps/web/src/features/calculator` -> `apps/web/src/types`
- `apps/web/src/features/cart` -> `apps/web/src/types`
- `apps/web/src/features/checkout` -> `apps/web/src/types`
- `apps/web/src/features/orders` -> `apps/web/src/types`
- `apps/web/src/features/plans` -> `apps/web/src/types`
- `apps/web/src/features/products` -> `apps/web/src/types`
- `apps/web/src/features` -> `apps/web/src/components/feedback`
- `apps/web/src/features` -> `apps/web/src/features/auth`
- `apps/web/src/features` -> `apps/web/src/features/cart`
- `apps/web/src/features` -> `apps/web/src/features/orders`
- `apps/web/src/features` -> `apps/web/src/features/plans`
- `apps/web/src/features` -> `apps/web/src/features/products`
- `apps/web/src/features` -> `apps/web/src/lib/utils`
- `apps/web/src/routes/orders` -> `apps/web/src/types`
- `apps/web/src/routes/product` -> `apps/web/src/types`
- `apps/web/src/routes` -> `apps/web/src/components/feedback`
- `apps/web/src/routes` -> `apps/web/src/features/cart`
- `apps/web/src/routes` -> `apps/web/src/features/checkout`
- `apps/web/src/routes` -> `apps/web/src/features/orders`
- `apps/web/src/routes` -> `apps/web/src/features/products`
- `apps/web/src/routes` -> `apps/web/src/lib/utils`
- `apps/web/src/routes` -> `apps/web/src/types`
- `apps/web/src` -> `apps/web/src/components/feedback`
- `apps/web/src` -> `apps/web/src/features/auth`
- `apps/web/src` -> `apps/web/src/features/cart`
- `apps/web/src` -> `apps/web/src/features/plans`
- `apps/web/src` -> `apps/web/src/lib/utils`

## Critical Modules

| Module | Fan-In | Fan-Out | Criticality |
|--------|--------|---------|-------------|
| `apps/web/src/types` | 20 | 0 | high |
| `apps/cms/src` | 0 | 12 | high |
| `apps/web/src/lib/utils` | 11 | 0 | high |
| `apps/web/src/routes` | 0 | 11 | high |
| `apps/web/src/features/products` | 3 | 5 | medium |
| `apps/web/src/components/feedback` | 7 | 0 | medium |
| `apps/web/src/features/cart` | 5 | 1 | medium |
| `apps/web/src` | 0 | 5 | medium |
| `apps/web/src/features/orders` | 3 | 2 | medium |
| `apps/web/src/features/plans` | 2 | 3 | medium |

## Risk Zones

- **Cyclic dependency detected (4 modules)** (confidence: 100%): The 4 modules apps/api/src, apps/api/src/lib, apps/api/src/routers, apps/api/src/rpc depend on each other through more than one cycle. One of them: apps/api/src -> apps/api/src/lib -> apps/api/src. This can cause initialization issues, make refactoring harder, and indicates tight coupling.
- **Layer violation: lib -> api (nextjs)** (confidence: 80%): Module "apps/api/src/lib" (layer: lib, level 0) imports module "apps/api/src" (layer: api, level 3). Inner layers should not depend on outer layers.

---

*Generated at 2026-11-07T07:36:03Z in 8.236018541s. 4629 facts, 89 insights.*
