# 06 — Administration and verification runbook

Human operators include manager, superadmin and support; consult [permissions](04-roles-and-permissions.md) for exact boundaries.

## Accounts and catalog

Create a customer with full name, unique phone, tier and account status. Company/address/identity and documents can be completed as needed; do not describe every optional address field as a schema requirement. OTP requires `status=active`; pending/suspended/banned customers cannot use normal sign-in. Account flags do not automatically cancel existing orders.

Use allowed categories for catalog restrictions. `hideExactStock` also disables ordering; `disableOrdering` can independently disable it. Review uploaded document status separately; document review does not substitute for reading the actual account status.

Create tile and other products with SKU/name/slug and the appropriate metadata. A tile must have a valid carton factor to be ordered. Other uses its primary unit; secondary weight/content is descriptive. Existing stock records prevent changing product type/primary unit. Packaging changes with open orders are rejected. There is no implemented general catalog-completeness scoring service.

## Price and stock CSV

Choose stock, price, or Kimia processing. Stock CSV uses `sku,inventorySqm`; price CSV uses `sku,basePricePerSqm` in whole Tomans. Kimia exports are headerless semicolon-delimited Windows-1256 or UTF-8 with unit, price in Rials, sellable stock, name, SKU and an empty trailing column. The system rounds converted prices to the nearest Toman; names and units are ignored.

Select an active warehouse for stock and Kimia. File stock is the reconciled sellable quantity after reservations; rows absent from the file remain unchanged. Files are limited to 1 MB and 1,000 rows. Invalid, duplicate, and unknown SKU rows are shown and skipped; valid rows are applied together only after confirmation. A stale preview is rejected. Price is global, while stock is warehouse-specific. Price export pages contain up to 1,000 rows and are suitable for reimport.

Direct balance update/delete and warehouse deletion are blocked. Completed imports have no automatic undo; use a fresh reconciled file for correction.

## Orders and plans

Create an inquiry warehouse and activate a supply source for each product manually. Staff explicitly move requests into review or a final result; merely opening a record does not start review. A result transition attempts an SMS using the explicitly configured `KAVENEGAR_API_KEY` and `WEB_URL`; missing configuration or provider failure does not roll back the status. Delivery is best effort: the notification hook can run before database commit and has no retry queue.

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

Root `dev` currently calls itself; use workspace commands when dev is requested. CMS/API/Web default to 5174/5175/5173. Do not manually edit generated route tree, Payload types or import map. Web catalog unit tests use Bun via `pnpm --filter @persianpart/web test:catalog:unit`.

PostgreSQL tests require disposable local targets: `CMS_TEST_DATABASE_URI` for `test:hardening:postgres` must name `cms_hardening_test`; that fixture drops/truncates tables. `CMS_MIGRATION_TEST_DATABASE_URI` for `test:hardening:migrations` points at a loopback `/postgres` control database with an explicit port and creates/deletes a random database. No environment variable means skip, not successful database verification.

Live API tests in `warehouse.live.test.ts` are opt-in: `WAREHOUSE_LIVE_TEST=true`, CMS on loopback 55174, and `WAREHOUSE_HTTP_TEST=true` for the API on 55175. They mutate a disposable seeded dataset. Browser mock scenario expects web on 55173. Tests must not invoke real OTP/SMS unintentionally.

## Migration, seed and deployment

CMS has one re-created baseline covering supply requests and support roles. It initializes an empty database and must not be applied over existing tables. Databases with prior migration history require a separately planned data-preserving transition or an explicitly authorized reset; this baseline does not perform either automatically.

Seed requires `NODE_ENV=development` and `CMS_SEED_DATABASE_URI` exactly matching the effective local database URI with a guarded name. On a fresh target it creates 26 tile products, two other products, two exact warehouses with 56 balances, one inquiry warehouse with three supply sources, one supply request, three customers and five demo orders. A sample tile has a 48-carton pallet factor. Existing balances and the sample request are preserved on rerun; seed is not a reset command. Use `DISABLE_SMS=true` for CMS notifications.

The historical [verification record](../.agents/brain/warehouse-merge-completion-2026-11-07.md) describes earlier migrations and is not a statement about a future environment.

New administrator accounts default to `superadmin`; explicitly selected manager, support and service roles remain available. Creating an administrator with a valid phone also creates or updates its customer account in the same transaction. On a fresh database, the first such account creates a zero-markup regular customer tier instead of assuming a fixed relationship ID.
