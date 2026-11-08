# Supply requests and pallet display — execution report

Date: 2026-11-08. Implemented against `ad2fe63` and the supply-request plan. A subsequent user request explicitly replaced the migration history with a new baseline and rebuilt the seed. The implementation adds independent supply sources and requests, warehouse-mode guards, customer API and UI, pallet display and order snapshots, explicit support-role access, and bounded best-effort SMS configuration.

## Verification

- `pnpm --filter @persianpart/cms test:hardening`: 77 passed, including stalled SMS request and response-body timeout cases.
- `pnpm --filter @persianpart/cms test:hardening:postgres`: 8 passed using a disposable local PostgreSQL database.
- `pnpm --filter @persianpart/cms test:hardening:migrations`: passed using a temporary local PostgreSQL cluster. The current suite covers fresh baseline schema, customer/supply access, snapshots, two-warehouse eligibility, concurrent requests and cancellation/review, notification failures, existing order and import flows, and clean down migration on disposable data. The former additive-upgrade test no longer applies after the requested reset.
- `pnpm --filter @persianpart/api test`: 18 passed; five opt-in live tests skipped in that run. A separate opt-in supply HTTP test passed against disposable local CMS and API servers, covering CMS error propagation, eligibility, ownership, replay, concurrent submit and cancellation.
- Contract, CMS and API TypeScript checks passed; web and CMS production builds passed. Vite reported the existing large-chunk warning.
- `PWA_BROWSER_CHANNEL=chrome pnpm --filter @persianpart/web exec playwright test e2e/pwa-supply.spec.ts e2e/pwa-warehouse.spec.ts`: both mock supply recovery and warehouse regression passed; the optional live scenario was skipped in that invocation. The supply recovery test reloads after a lost response and retries the same key even after stock and source change. A separate earlier run with disposable local CMS and API servers enabled passed both mock and live scenarios. Browser screenshots at mobile and desktop sizes were inspected.
- The rebuilt seed ran twice against a disposable database after the new baseline. Counts remained two exact warehouses, one inquiry warehouse, three sources, and one request; the tile factor was 48, the support fixture had the support role, the inquiry warehouse had no stock rows, and the request exceeded the largest exact stock.
- CTO sub-agent scoped re-review approved the purchase handoff and support-role access, 9/10. It did not independently rerun the final PostgreSQL and browser lanes.

## Boundaries and limitations

No production migration or deployment was performed and no real SMS was sent. SMS remains best effort: a result notification can be attempted before commit, and no delivery, retry or exactly-once guarantee is claimed. The new single baseline targets empty databases; it is not a data-preserving upgrade for installations using the old migration history. CMS requires explicit `KAVENEGAR_API_KEY` and `WEB_URL` for notification attempts.

## Admin bootstrap correction (2026-11-08)

The server log showed FK 23503 because admin synchronization assumed customer tier ID 1. The hook now uses an existing tier or creates a regular zero-markup tier, threads the original request through nested operations, and fails atomically without logging raw customer data. New admins default to superadmin. The migration history was reset again to `20261108_152041_baseline`, preserving the custom database constraints. The fresh PostgreSQL migration suite passed, including first-admin creation with no tiers, Persian phone normalization and repeated update without duplicate users.
