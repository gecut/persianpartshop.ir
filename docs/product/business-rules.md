# 02 — Business rules and calculations

Reviewed: 2026-11-22. Each rule states **Rule**, **Why** (business reason; `[UNKNOWN]` when not given) and a **numeric example**. Decisions from the warehouse session are preserved here. Business reasons come from the product owner (2026-11-22).

## R1. Money and price

**Rule.** Currency is integer Tomans. `customerUnitPrice = round(basePricePerSqm × (1 + markupPercent / 100))`. Price is shared across warehouses. Negative markup is a tier discount. Customer-facing mapping omits the raw base price.

**Why.** One price list is exported from Kimia and applied globally; customer types differ only by percentage. Beta currently has `markupPercent = 0` for both types.

**Example.** `basePricePerSqm = 1,177,050`, markup 0 → 1,177,050. Markup 10 → `round(1,177,050 × 1.10) = 1,294,755`.

The `basePricePerSqm` name is historical: for tile it is per m²; for non-tile it is per primary unit.

## R2. Quantity rounding and line totals

**Rule.** For tile `factor = sqmPerCarton`; for non-tile `factor = 1`.

```text
wholeUnits = ceil(requestedQuantity / factor)
deliverableQuantity = round(wholeUnits × factor, 2)
lineTotal = round(customerUnitPrice × deliverableQuantity)
subtotal = sum(lineTotal); discountAmount = taxAmount = 0; finalTotal = subtotal
```

**Why.** Tiles ship only in whole cartons. Non-tile goods sell in whole primary units (bag, bucket…). Pallet equivalence is display-only and never rounds an order.

**Example (observed, beta order 6).** 97 m² of «آذرخش قرمز تیره», `factor 1.08` → `ceil(97/1.08) = 90` cartons → `90 × 1.08 = 97.2` m² → `97.2 × 1,177,050 = 114,409,260`. Matches the stored `totalPrice`.

**Example (non-tile).** Request 2.2 bags → 3 bags billed, even if legacy `sqmPerCarton` is 1.44. Fractional sales of kg/liter are not implemented.

Authoritative calculation: [prepare order hook](../../apps/cms/src/collections/orders/_prepare-order.before-validate.ts). Client arithmetic is a preview only.

## R3. One warehouse per cart

**Rule.** Sellable balance belongs to one product/warehouse pair; balances are never summed. The whole cart must fit one active warehouse after rounding. Zero candidates → reject; one → bind automatically; several → explicit selection with no default. Removing the last line clears the binding. Changing warehouse requires submitting or emptying the cart.

**Why.** Orders and reservations are per-warehouse, and the company's real warehouse systems fulfill from one location. Mixed carts would need transfers/splits, which are out of scope.

**Example.** Cart A needs 100 m² in Mashhad and 50 m² of another SKU that Mashhad lacks → rejected; the old draft stays.

## R4. Two warehouse stock modes

**Rule.** `exact` warehouses hold a numeric balance and are reserved at order time. `inquiry` warehouses hold **no** balance (`inventorySqm = null`); availability is unknown to the system.

**Why.** The company has no visibility into the factory's stock. Staff must ask the factory contact whether the product is available and under what terms. That is why the factory warehouse is `inquiry`.

Stock mode is fixed once history exists; to change it, create a new warehouse and deactivate the old one. Product-level legacy stock columns (`inventorySqm`, `stockCartons` on `products`) remain only for schema history: hidden, REST-write-blocked, never a source for catalog, reservation or cancellation. A missing `warehouse-stock` row means zero. Catalog badges and hint caps use the **maximum balance of one active warehouse**, not the sum of warehouses; real fulfillability depends on the whole cart.

**Observed (beta).** `mashhad = exact`, `factory = inquiry`; factory stock rows have `inventorySqm: null`.

## R5. Supply request (classic manual process)

**Rule.** A supply request is separate from an order and reserves nothing. Eligible only when its active source is in an active `inquiry` warehouse **and** no single active `exact` warehouse can fulfill the rounded quantity. Statuses: `new`, `reviewing`, `supplied`, `unavailable`, `cancelled_by_customer`. The customer can cancel only before review starts; staff may correct a non-cancelled status. Response due = 48 continuous hours from creation; overdue requests remain open.

**Why.** Handling may require contacting the producing factory or checking other warehouses, so it is slow by nature; 48 h is the company's policy. After `supplied`, coordination happens outside the system.

**Example.** Request 10,000 m² at `factor 1.44` → `ceil(10000/1.44) = 6945` packages → `roundedQuantity 10,000.8`; estimate `10,000.8 × 69,069 ≈ 690,745,255`. Observed in beta request 4.

## R6. Order submission and retry

**Rule.** Only authenticated, permitted customers submit. CMS validates active customer, flags, allowed categories, active products, warehouse, finite positive quantities. Duplicate lines merge before rounding. Max 1,000,000 per product and 100 lines. CMS recomputes price and units, snapshots the order, and reserves every balance in one transaction with stable lock order; any failure rolls back everything. Same customer + key + fingerprint replays the existing order without a second decrement; a changed payload with the same key conflicts.

**Why.** A reservation without payment is a binding commitment, so the server, not the client, must be the only authority for price and stock. Mobile networks retry; idempotency prevents double reservation.

**Example.** Two taps on «ثبت» with the same key → one order, one decrement.

## R7. Order lifecycle and customer cancellation

**Rule.** Persisted transitions: `pending → approve → completed`. `pending` can be cancelled by the customer (within 60 minutes of `createdAt`) or by an admin; `approve` can be cancelled by an admin. Cancelled and completed are terminal. After 60 minutes the customer display changes but stored status stays `pending` (no automatic transition). Admin cancellation restores the exact original quantities to the original warehouse (even if now deactivated); repeating cancellation must not restore twice.

**Why.** An order is placed without payment but counts as firm. The 60-minute window is a company policy that gives the customer a short grace period to correct mistakes (observed cancellation notes: «ثبت اشتباه فاکتور», «تغییر در متراژ یا اقلام سفارش»). After that, staff and support treat it as committed.

**Example (observed).** Order 6: created 16:15:22, cancelled 16:20:54 (5.5 min) → `cancelled_by_customer`.

**Beta timing note.** Order 1 went `approve` → `completed` six seconds apart (likely a test; `[ASSUMPTION]`); nothing after `completed` is recorded.

**Known gap.** The owner wants the **admin panel** to show that an order is still inside the 60-minute window so support can tell that the customer may still cancel. No such indicator exists in `apps/cms/src/collections/orders` (checked 2026-11-22). The customer-side indicator exists in `apps/web` (`_cancel-countdown-badge.tsx`). Mark any claim of an admin indicator as unimplemented.

## R8. After `completed`

**Rule.** Settlement, shipping and delivery are **not** modeled. `completed` ends the system's responsibility.

**Why.** Accounting and warehouse systems own those steps. This system mediates only the order record and reservation.

## R9. Quality grade

**Rule.** `grade` is a manufacturer-defined quality class and is metadata; the system attaches no commercial logic to it. Allowed values: `grade_1`, `grade_2`, `grade_3`, `grade_4`, `grade_d`, `grade_c`, `cg3`. Naming convention: slab grade 4 must be `grade_d` ([catalog-product-standard](../standards/catalog-product-standard.md)).

**Why.** The factory decides the class and its definition; the company does not interpret it here.

**Example.** The same design may exist as two SKUs: `1221152` (`grade_1`, 3,213,000/m²) and `1221153` (`grade_d`, 1,927,800/m²) — observed beta products 668 and 669.

## R10. Customer documents and status

**Rule.** The customer uploads documents; an admin manually verifies and approves or rejects (with reason). Whether an account may log in depends on `status`, bans and pending document approval ([flows](flows.md)). Putting someone into hold is a manual company decision based on financial relationship and policy.

**Why.** Trust is relationship-based; the company decides case by case.

## R11. Plans («طرح»)

**Rule.** A plan is an announcement: title, content, assigned users, optional products, optional start/expiry. It never changes prices or order totals, and holds no discount, interest or credit logic.

**Why.** Plans inform customers of sales offers (a percentage discount, or credit/payment terms). The calculation is done by company staff outside this system. Beta has **0** plans.

## R12. Price and stock import (Kimia)

**Rule.** Price CSV updates global product price; stock CSV picks one warehouse per file and sets sellable primary-unit balances after reservations. Rials convert to Tomans. Preview is signed (actor, expiry, warehouse, rows, balance revisions, product timestamps); any stale row rejects the entire apply transaction. With «صفر کردن کالاهای خارج از فایل» (`zeroMissing`, default off), absent positive balances in the chosen exact warehouse become 0 in the same transaction. A completed import has no automatic undo.

**Why.** The accountant exports a file from Kimia each day after all orders are closed, at the end of office hours, and hands it to this system to refresh stock and prices. The CSV is one input template; others (a future Kimia API, another accounting package) may be added. See [operations](../operations/runbook.md).

**Example.** Kimia price 11,770,500 Rial → 1,177,050 Tomans.

## R13. Immutability and reorder

**Rule.** Order user, warehouse, items, amounts, number and retry identity are protected after creation; changes require cancellation and a fresh order. Packaging changes are blocked by open orders/requests. Reorder creates a **fresh** draft using current permissions, prices, units and stock; it cannot silently replace a non-empty draft or reopen a cancelled order. Custom order submission is disabled («ثبت سفارش اختصاصی فعلاً فعال نیست.»).

**Why.** Orders are firm records; stock was reserved against the exact snapshot.

## R14. Web draft and warehouse contract

**Rule.** The browser keeps one draft per account (no shared server cart, no cross-device sync). Legacy stores migrate once into draft version 3; for conflicting quantities of one SKU the larger is kept with a review message, and old data must be revalidated and a warehouse chosen again. Late responses from a previous account or a cancelled operation are ignored; a change in another tab marks the quote as needing revalidation. `warehouse.availability` takes products and quantities in selling units and returns only the warehouses able to supply the whole cart plus final price/quantity; it never exposes base price or markup. `order.submit`, `shopping.createOrder` and cart validation require `warehouseId` and share one implementation. The idempotency key is hashed per customer. Draft data is cleared only after a successful server response; edits made during submission are kept.

**Why.** The server reservation is the only oversell guard; the client is a preview. Old clients without a warehouse cannot place orders after the contract change, and code cannot be downgraded to product-level stock once new orders exist.
