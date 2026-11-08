# 02 — Business rules and calculations

Reviewed: 2026-11-07. Decisions from the warehouse session are preserved here and in [document 07](07-warehouses.md).

## Units and prices

Currency is integer Tomans. Customer unit price is `round(basePricePerSqm × (1 + markupPercent / 100))`. Price is shared across warehouses. Negative markup represents a tier discount. Customer-facing catalog/quote mapping omits the raw base price; do not infer that every direct CMS access path is protected by that mapping.

For tile, `factor = sqmPerCarton`; for other, `factor = 1`:

```text
wholeUnits = ceil(requestedQuantity / factor)
deliverableQuantity = round(wholeUnits × factor, 2)
lineTotal = round(customerUnitPrice × deliverableQuantity)
subtotal = sum(lineTotal)
discountAmount = taxAmount = 0
finalTotal = subtotal
```

Tile example: request 10 m², factor 1.44 → 7 cartons, 10.08 m² billed. Other example: request 2.2 bags → 3 bags billed, even if old `sqmPerCarton` is 1.44. Current other-unit behavior rounds to whole units, including kg/liter; fractional sales are not implemented. Secondary package weight is not an order multiplier. Totals of bags and square meters are displayed separately. No standalone 1% application discount is applied.

Authoritative calculation: [prepare order hook](../apps/cms/src/collections/orders/_prepare-order.before-validate.ts). Availability preview: [warehouse router](../apps/api/src/routers/warehouse.ts). Client arithmetic is a preview, not authority.

## Stock and binding

Supply requests are separate from orders and reserve no stock. A request is eligible only when its active source is in an active inquiry warehouse and no single active exact warehouse can fulfill the rounded quantity. Pallet equivalence is display-only and never rounds an order or request to a pallet.

Sellable balance belongs to exactly one product/warehouse pair; warehouse balances are never summed to determine fulfillment. Catalog hints use the maximum balance of one active warehouse and are not a reservation or a guarantee that a mixed cart is fulfillable.

The whole cart must fit one active warehouse after rounding. At first addition: zero candidates rejects; one binds automatically with visible name; multiple requires explicit selection with no default. Once bound, additions/quantity changes must fit that same warehouse. A failed change preserves the previous draft. Removing the last line clears warehouse binding. Buying from another warehouse requires submitting or emptying the active cart first.

Drafts persist by account in the same browser, not in a shared server cart. Cross-tab updates invalidate the quote. Legacy store migration preserves lines and requests revalidation; conflicting old quantities preserve the larger value with a review message.

## Submission and retry

Only authenticated, permitted customers can submit. CMS validates active customer, catalog-only flags, allowed categories, active products, warehouse and finite positive quantities. Duplicate product lines consolidate before rounding. Request quantities are capped at 1,000,000 per product; submission accepts at most 100 lines.

CMS recalculates current price and units, snapshots the order, and reserves every balance in one transaction. Stable product lock order and conditional stock updates prevent oversell; failure rolls back the entire order. Nested Payload operations retain `req` to share the transaction.

Same customer/key/fingerprint replays an existing order before new availability checks, without decrementing stock twice. A changed payload with the same key conflicts. Failed create retries are reconciled against a concurrent winner. Client network failure preserves the draft/key; successful responses only clear the matching submitted draft and never another account's draft.

## Lifecycle and cancellation

Supply requests use `new`, `reviewing`, `supplied`, `unavailable`, and `cancelled_by_customer`. The customer can cancel only before review has started; staff may correct a non-cancelled status. The response deadline is 48 continuous hours from creation and overdue requests remain open.

Persisted transitions are `pending → approve → completed`; `pending` can cancel by customer/admin and `approve` can cancel by admin. Cancelled/completed orders are terminal. Contract legacy aliases do not imply additional supported persisted transitions.

Customer self-cancellation requires `pending` and a request within 60 minutes of `createdAt`. Passing the deadline changes the customer display; it does not itself persist an automatic status transition. Administrative cancellation can release pending/approved reservations. Restore uses the exact original deliverable quantities and original warehouse, even if that warehouse has since been deactivated. Repeated cancellation must not restore twice.

Order user, warehouse/snapshots, items, amounts, number and retry identity are protected after creation. Changes require cancellation and a fresh order. Custom order submission returns «ثبت سفارش اختصاصی فعلاً فعال نیست.»

## Reorder and CSV

Reorder creates a fresh browser draft using current permissions/prices/units/stock and fresh warehouse selection. It neither reopens nor edits an old order and cannot replace a nonempty draft silently.

Price CSV updates global product price; stock CSV chooses warehouse at file level and sets sellable primary-unit balances after reservations. Preview is not a reservation. Signed snapshots include actor, expiry, warehouse, rows, balance revisions and product update timestamps. Stale rows or changed product metadata reject the whole apply transaction. See [operations](06-admin-and-operations.md) for separate limits and workflows.
