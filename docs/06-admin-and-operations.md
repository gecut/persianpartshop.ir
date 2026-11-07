# 06 — Administration and verification runbook

Reviewed: 2026-11-07. Human operators are manager/superadmin; consult [permissions](04-roles-and-permissions.md) for exact boundaries.

## Accounts and catalog

Create a customer with full name, unique phone, tier and account status. Company/address/identity and documents can be completed as needed; do not describe every optional address field as a schema requirement. OTP requires `status=active`; pending/suspended/banned customers cannot use normal sign-in. Account flags do not automatically cancel existing orders.

Use allowed categories for catalog restrictions. `hideExactStock` also disables ordering; `disableOrdering` can independently disable it. Review uploaded document status separately; document review does not substitute for reading the actual account status.

Create tile and other products with SKU/name/slug and the appropriate metadata. A tile must have a valid carton factor to be ordered. Other uses its primary unit; secondary weight/content is descriptive. Existing stock records prevent changing product type/primary unit. Packaging changes with open orders are rejected. There is no implemented general catalog-completeness scoring service.

## Warehouse setup and stock CSV

1. Create an active warehouse with a stable unique code. Rename/deactivate instead of deleting.
2. Open warehouse stock administration and choose the target warehouse.
3. Upload or paste UTF-8 CSV with exactly `sku,inventorySqm`; BOM is accepted. Limits: 1 MB, 1–1000 rows, existing unique SKUs, nonnegative amounts with at most two decimals, maximum 1,000,000,000 per row.
4. Amounts are sellable stock **after reservations**, in each product's primary unit. Missing rows are unchanged. A missing product/warehouse balance can be created by apply.
5. Preview, then confirm application within 15 minutes using the same actor. Balance or product changes invalidate preview; obtain a fresh one. Apply is one transaction, including audit. Do not attempt to reuse an already applied token.
6. Export the selected warehouse from its stock endpoint when needed. An accepted stale physical count can still be operationally wrong: the system validates revisions, not the time of a physical count outside the system.

Direct balance update/delete and warehouse deletion are blocked. No automatic undo of a completed import exists. A compensating import needs a fresh, reconciled sellable count.

## Global price CSV

Use the official Payload import-export interface with `sku,basePricePerSqm`, at most 100 rows. Base prices are whole nonnegative Tomans in the primary selling unit. Unknown/duplicate SKU and invalid prices are rejected; the flow updates existing products and does not create partial products. Stock column `inventorySqm` is rejected. It does not share the stock CSV signed-preview workflow; do not promise identical transaction/rollback guarantees for plugin imports without separate verification.

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

CMS has nine registered migrations as of this review. Warehouse foundation follows the two remote product/customer migrations, then order binding, retry fingerprint, sales-unit snapshot and plan-title constraint correction. `plans.title` null values are populated before adding its required constraint.

Warehouse order migration rejects nonempty historical orders rather than inventing a warehouse assignment. For preserved data, design and approve a historical allocation/backfill before applying it. Reset is appropriate only for an explicitly approved disposable target. Automatic production migration configuration does not remove this prerequisite and does not establish zero downtime.

Seed requires `NODE_ENV=development` and `CMS_SEED_DATABASE_URI` exactly matching the effective local database URI with a guarded name. It creates 26 tile products, two other products, two demo warehouses, 56 balances, three customers and five demo orders on a fresh target. Existing balances are preserved on rerun; seed is not a reset command. Use `DISABLE_SMS=true` for CMS plan notifications.

The session verification used independent temporary databases. It did not migrate/reset the working `persianpart_cms`, deploy, or push. See the [verification record](../.agents/brain/warehouse-merge-completion-2026-11-07.md) for measured checks and limitations; it is historical evidence, not a statement about a future environment.
