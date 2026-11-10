# CMS hook integrity and verification

## Operational behavior

Open orders allow status, delivery address and notes changes. Completed/cancelled orders allow notes only. Identity, financial amounts, line snapshots and timeline are server-owned. Order guards inspect raw input under the order lock before Payload removes fields denied by field permissions; this lets the admin display disabled controls without silently accepting attempts to change protected values.

Timeline form echoes compare event statuses and timestamp instants, tolerating equivalent timezone/precision formats and generated/missing form row IDs. Valid echoes are discarded in favor of persisted history; real event changes remain rejected. Status changes append exactly one server-owned event. Admin labels distinguish review, voucher issuance and final delivery; the legacy generic cancellation option is shown only on existing legacy records.

Packaging changes are blocked by pending/approved orders and new/reviewing supply requests. Product/warehouse identity on balances is permanent. Managers can edit activity/report metadata; numeric balances and revisions belong to reservation, restoration and CSV operations. Inactive balances never fulfill a purchase, but cancellation can restore their original reservation.

Reference deletion checks cover configured relationship/upload fields, arrays and many-to-many fields. Database foreign keys protect the same dependencies during races. Child ownership cascades remain intact. Ordinary delete errors name a blocking record and explain whether to remove the relationship or deactivate the reference instead.

## Migration and compatibility

`20261110_120000_hook_integrity` adds optional line name/SKU snapshots and a unique optional admin/customer relationship, synchronizes product dimensions from their reference, and tightens validation/foreign keys. It refuses incompatible legacy factors, missing required sales relationships, invalid dimensions/markups/plan dates and category cycles. It does not delete or guess corrections. Review the failing records, reconcile them, then rerun the normal CMS migration command before deploying the updated CMS/API.

Existing admin/customer links are not inferred from matching phone numbers. A superadmin explicitly selects the associated customer. An unlinked new manager with an unused phone can create a new linked customer. Deactivation suspends the linked account; reactivation is manual. Historical order names/SKUs that were never stored are not backfilled as historical facts.

The migration can roll back before new snapshots/links are stored; otherwise its down operation refuses data loss. Original FK actions are recorded for rollback.

## Commit, audit and error boundaries

Expected field errors use Payload ValidationError. Business conflicts use public APIError with stable `data.code` and a Persian message. The API translates structured errors without matching Persian prose and masks internal server details.

SMS notifications are held by the owning transaction and sent only after the actual PostgreSQL commit succeeds. Payload/Drizzle 3.90.2's lifted transaction implementation can swallow completion failures; the small adapter integration owns the completion promise while retaining the adapter session contract. A real deferred-FK failure at COMMIT is covered by integration tests. Rollback discards notifications; provider failure does not invalidate a committed write. There is no retry/durable queue, so process termination between commit and send can lose a notification.

Generic audit is best effort. Its PostgreSQL insert runs directly in the owning session inside a savepoint: a nested Payload create would otherwise roll back the whole session on failure. CSV's mandatory transactional audit retains its separate behavior.

## Verification

- `pnpm --filter @persianpart/cms test:hardening`: hook comparisons, field validation, document protection, error shape and notification lifecycle.
- `pnpm --filter @persianpart/cms test:hardening:migrations`: full Payload CRUD, schema/upgrade/down checks, invalid-migration preflight, full form writes, permissions, dimensions, immutable references, real commit failure, audit failure and concurrency tests. Requires the documented disposable PostgreSQL control target.
- `pnpm --filter @persianpart/cms test:hardening:postgres`: oversell, cancellation races and reservation rollback on its separate disposable database.
- `pnpm --filter @persianpart/api test`: structured CMS error translation and existing API regressions. Opt-in warehouse/supply HTTP tests exercise the actual CMS SDK/Hono boundary against seeded disposable services.
- CMS/API/Web typechecks and production builds; browser smoke checks for approval, address/notes edits, terminal notes, cancellation, disabled controls and a visible packaging-conflict message.

No test requires modifying the application database. An unset live-test variable means the corresponding test was skipped, not verified.

### Observed checks on 2026-11-10

| Check | Result |
| --- | --- |
| CMS hardening unit suite | 87 passed |
| Reservation PostgreSQL suite | 8 passed |
| Full migration/Payload integration suite | Passed, including preflight rejection, upgrade/down/up, real COMMIT failure and both concurrency scenarios |
| API default suite | 36 passed; 5 opt-in cases skipped in this invocation |
| Warehouse live CMS/HTTP cases, enabled separately | 3 passed |
| Supply-request live HTTP case, enabled separately | 1 passed |
| QR live HTTP case | Not enabled; outside these hook changes |
| Browser, disposable PostgreSQL | Approval, address/notes, terminal notes and cancellation saved; packaging conflict displayed its Persian message and tracking reference |
| Typecheck | CMS, API and Web passed |
| Production build | CMS and Web passed; API build is the same no-emit compiler check |

All PostgreSQL and browser changes used a temporary instance on a separate loopback port. The application database was not migrated or edited. Before deployment, apply the new migration through the normal CMS migration command and explicitly link existing admin/customer accounts where appropriate.

The timeline-echo follow-up passed 90 CMS unit tests, the full Payload/PostgreSQL integration suite (including full-form echoes on both notes and status updates), TypeScript and the CMS production build.
