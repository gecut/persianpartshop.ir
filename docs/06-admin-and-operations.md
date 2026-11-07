# 06 — Administration and verification runbook

Reviewed: 2026-11-07. Human operators are manager/superadmin; consult [permissions](04-roles-and-permissions.md) for exact boundaries.

## Accounts and catalog

Create a customer with full name, unique phone, tier and account status. Company/address/identity and documents can be completed as needed; do not describe every optional address field as a schema requirement. OTP requires `status=active`; pending/suspended/banned customers cannot use normal sign-in. Account flags do not automatically cancel existing orders.

Use allowed categories for catalog restrictions. `hideExactStock` also disables ordering; `disableOrdering` can independently disable it. Review uploaded document status separately; document review does not substitute for reading the actual account status.

Create tile and other products with SKU/name/slug and the appropriate metadata. A tile must have a valid carton factor to be ordered. Other uses its primary unit; secondary weight/content is descriptive. Existing stock records prevent changing product type/primary unit. Packaging changes with open orders are rejected. There is no implemented general catalog-completeness scoring service.

## Price and stock CSV

Choose stock, price, or Kimia processing. Stock CSV uses `sku,inventorySqm`; price CSV uses `sku,basePricePerSqm` in whole Tomans. Kimia exports are headerless semicolon-delimited Windows-1256 or UTF-8 with unit, price in Rials, sellable stock, name, SKU and an empty trailing column. The system rounds converted prices to the nearest Toman; names and units are ignored.

Select an active warehouse for stock and Kimia. File stock is the reconciled sellable quantity after reservations; rows absent from the file remain unchanged. Files are limited to 1 MB and 1,000 rows. Invalid, duplicate, and unknown SKU rows are shown and skipped; valid rows are applied together only after confirmation. A stale preview is rejected. Price is global, while stock is warehouse-specific. Price export pages contain up to 1,000 rows and are suitable for reimport.

Direct balance update/delete and warehouse deletion are blocked. Completed imports have no automatic undo; use a fresh reconciled file for correction.

## Orders and plans

Orders arrive as `pending` with warehouse and immutable authoritative line amounts. Staff can approve (`approve`), complete, or cancel within the allowed transitions. Print the warehouse name and original quantities; no picking across warehouses. Customers can cancel pending orders within 60 minutes; staff can cancel pending/approved orders before completion. Cancelled/completed orders cannot reopen. No required structured staff-reason field or multi-stage preparing/ready workflow is implemented.

Plans require title/content and assigned users, with optional product references and start/expiry. Activate the plan and review derived display status. Plan terms are text, not automatically applied financing math. Adding recipients may send notifications; disable notification SMS in seed/test environments.

## Local commands

Run from repository root using pnpm:

```bash
pnpm install
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm --filter @persianpart/api typecheck
pnpm --filter @persianpart/web build
pnpm --filter @persianpart/cms exec tsc --noEmit --incremental false
pnpm --filter @persianpart/cms build
pnpm --filter @persianpart/cms test:hardening
pnpm --filter @persianpart/api test
```

Root `dev` currently calls itself; use workspace commands when dev is requested. CMS/API/Web default to 5174/5175/5173. Do not manually edit generated route tree, Payload types or import map. Web has no configured unit-test runner; its warehouse browser script uses Playwright CLI.

PostgreSQL tests require disposable local targets: `CMS_TEST_DATABASE_URI` for `test:hardening:postgres` must name `cms_hardening_test`; that fixture drops/truncates tables. `CMS_MIGRATION_TEST_DATABASE_URI` for `test:hardening:migrations` points at a loopback `/postgres` control database with an explicit port and creates/deletes a random database. No environment variable means skip, not successful database verification.

Live API tests in `warehouse.live.test.ts` are opt-in: `WAREHOUSE_LIVE_TEST=true`, CMS on loopback 55174, and `WAREHOUSE_HTTP_TEST=true` for the API on 55175. They mutate a disposable seeded dataset. Browser mock scenario expects web on 55173. Tests must not invoke real OTP/SMS unintentionally.

## Migration, seed and deployment

CMS uses a single baseline migration generated from the current Payload schema, including warehouse constraints. It is intended for a freshly created empty database. Existing databases using the previous migration history require an explicitly planned reset or a separate data-preserving migration; do not apply the baseline over existing tables.

Seed requires `NODE_ENV=development` and `CMS_SEED_DATABASE_URI` exactly matching the effective local database URI with a guarded name. It creates 26 tile products, two other products, two demo warehouses, 56 balances, three customers and five demo orders on a fresh target. Existing balances are preserved on rerun; seed is not a reset command. Use `DISABLE_SMS=true` for CMS plan notifications.

The historical [verification record](../.agents/brain/warehouse-merge-completion-2026-11-07.md) describes earlier migrations and is not a statement about a future environment.
