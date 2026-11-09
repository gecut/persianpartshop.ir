# Shared customer tracking numbers — execution report

## Result
- One PostgreSQL sequence allocates positive numbers for both orders and supply requests in CMS create hooks.
- Historical records receive chronological numbers across both tables; legacy identifiers, primary keys, and links remain intact.
- Customer DTOs expose the shared number through existing orderNumber/requestNumber string fields. No contract shape change.
- The activity feed and order detail share a small tracking badge; invoice, supply detail, and success messages use Persian digits without prefixes.
- The development database migration ran successfully. Production requires the new CMS migration before publishing the updated API/UI.

## Verification
- PostgreSQL isolated-database test: historical interleaving, preservation of legacy identifiers, 40 concurrent allocations, unique constraint, and gaps after rollback passed.
- Full CMS migrations/Local API suite: fresh schema metadata, actual order/supply creation and immutable tracking numbers, stock lifecycle, and activity feed passed.
- API unit tests: 34 passed, 5 opt-in live tests skipped.
- Typecheck: web/API/CMS passed. Generated create fixtures now explicitly supply existing required stock defaults.
- Web production/PWA build passed; existing main chunk size warning remains.
- Browser: activity feed at 393px and desktop; order 8 matched its detail and invoice, next supply request displayed 9. No real order/request submitted during visual verification.

## Semantics
The sequence is globally shared and monotonic by allocation. Rollbacks can leave gaps; concurrent transactions may commit in a different order. Numbers are immutable and never derived from list position or displayed database IDs.
