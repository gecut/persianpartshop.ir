# Printable Pre-Invoice Best-Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the printable pre-invoice (`OrderInvoiceModal`) in `apps/web` correct, typed, accessible and print-safe, showing only real server data.

**Architecture:** Pure formatting/derivation lives in one tested helper file inside the invoice module; the API-document → `Order` mapper moves to its own typed, tested file; the components become thin renderers of those values. Printing uses a plain semantic `<table>` and native `beforeprint`/`afterprint` events instead of HeroUI Table overrides and timers.

**Tech Stack:** React 19, TypeScript (strict), Tailwind CSS v4, HeroUI v3 (buttons only), Zod contract `@persianpart/contract`, `bun test`, `Intl` (`fa-IR`, `fa-IR-u-ca-persian`).

**Spec:** This plan is its own spec. Source analysis: session review of `apps/web/src/modules/orders/order-invoice-modal/*`, `apps/web/src/modules/orders/order-store.ts`, `apps/web/src/styles/globals.css` (print block, lines ~534–700), sample PDFs v1/v2.

## Already done (uncommitted in working tree — Task 1 commits it)

- Header: company name `بازرگانی زمانیان`, subtitle `پیش‌فاکتور فروش`, removed «نوع سند» and «انبار تأمین», validity `۲۴ ساعت`.
- Buyer card: one compact row (نام / همراه / فروشگاه), delivery address removed, phone in Persian digits.
- Signatures: English captions removed; labels `مهر و امضای فروشنده` / `امضا و تایید خریدار`.
- Footer sentence removed; `savedAt` line is `no-print`; SKU wrapped in `<bdi dir="ltr">`.
- Totals: breakdown rows only when discount or tax > 0.
- `order-store.ts`: `storeName` fallback `'بازرگانی دهقان (پرشین پارت)'` → `''`; `_order-delivery-card.tsx` shows `'—'` when empty.

## Global Constraints

- Package manager `pnpm`; tests `bun test` colocated as `*.test.ts` next to the code (see `apps/web/src/modules/orders/build-reorder-draft.test.ts` for style: `import { describe, expect, test } from 'bun:test'`).
- No `any`. Derive API shapes from `@persianpart/contract`; never redeclare them.
- Files kebab-case; module-private files start with `_`; no barrel `index.ts`; imports `@/…` across directories, relative inside the module.
- Logical Tailwind utilities only (`ms-/me-/ps-/pe-/start-/end-`, `text-start/text-end`), never `left/right/ml/mr/text-left/text-right`.
- All customer-visible digits Persian. Decimal separator `٫`, grouping in quantities `٬` (via `Intl.NumberFormat('fa-IR')`). Money keeps the app-wide `formatToman` from `@/lib/utils/currency` (do NOT change it — app-wide impact).
- Dates in the invoice use time zone `Asia/Tehran`.
- Never fabricate data: a missing value renders `—` or the row is hidden; never `|| 1`, never a seller name as buyer fallback.
- Do not add dependencies.
- Do not touch `apps/web/src/routeTree.gen.ts`.
- Commit only when the human has approved execution; Conventional Commits, body explains why, footer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A product name 80+ characters long — must wrap inside the «مشخصات» column, never widen the table or overflow the page. (Task 4 test: `wraps long product names`.)
2. 30+ items — table must break across pages with the header row repeated and no row split across pages. (Task 4: CSS `thead{display:table-header-group}` + `tr{break-inside:avoid}`; verified in Task 8 print check.)
3. Discount > 0 with tax = 0 (and vice versa) — breakdown rows appear, tax label has no hard-coded rate. (Task 5 test.)
4. Totals ≥ 1,000,000,000 toman — amount-in-words still correct (`میلیارد`). (Task 2 test.)
5. `other`-type item with fractional quantity (e.g. 2.5 کیلوگرم) — shows `۲٫۵ کیلوگرم`, not `2.5` or `۲.۵`. (Task 2 + Task 4 tests.)

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-format.ts` (create) | Pure invoice helpers: quantity, Tehran date-time, validity deadline, toman in words. |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-format.test.ts` (create) | Tests for the above. |
| `apps/web/src/modules/orders/order-mapper.ts` (create) | `mapDocToOrder`, `buildFullOrderTimeline` moved from `order-store.ts`, typed with contract. |
| `apps/web/src/modules/orders/order-mapper.test.ts` (create) | Mapper tests. |
| `apps/web/src/modules/orders/order-store.ts` (modify) | Import mapper; keep queries/mutations only. |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-items-table.tsx` (modify) | Plain `<table>`. |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-totals.tsx` (modify) | Totals + words. |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-header.tsx` (modify) | Validity deadline. |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-terms.tsx` (modify) | Copy fix. |
| `apps/web/src/modules/orders/order-invoice-modal/_invoice-action-bar.tsx` (modify) | Copy + class fix. |
| `apps/web/src/modules/orders/order-invoice-modal/order-invoice-modal.tsx` (modify) | Dialog a11y, Escape, print title. |
| `apps/web/src/styles/globals.css` (modify, print block only) | A4 page, table break rules, drop HeroUI-table hacks. |
| `apps/web/src/modules/checkout/pre-invoice-modal.tsx` (modify) | Stop sending a fixed system note. |

---

### Task 1: Commit the already-applied basic fixes

**Files:** the 8 modified files listed by `git status --porcelain apps/web/src`.

- [ ] **Step 1: Verify state**

Run: `pnpm --filter @persianpart/web exec tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 2: Commit**

```bash
git add -- apps/web/src/modules/orders/order-invoice-modal apps/web/src/modules/orders/order-store.ts apps/web/src/modules/orders/order-detail/_order-delivery-card.tsx
git commit -m "fix(web): simplify pre-invoice header, buyer card and signatures"
```
Body: list the bullets from «Already done» above.

---

### Task 2: Pure invoice helpers

**Files:**
- Create: `apps/web/src/modules/orders/order-invoice-modal/_invoice-format.ts`
- Test: `apps/web/src/modules/orders/order-invoice-modal/_invoice-format.test.ts`

**Interfaces:**
- Produces:
  - `export const INVOICE_VALIDITY_HOURS = 24`
  - `export function formatInvoiceQuantity(value: number): string`
  - `export function formatInvoiceDateTime(date: Date | string): string`
  - `export function invoiceValidUntil(createdAt: string): Date`
  - `export function tomanToPersianWords(amount: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'bun:test'
import { formatInvoiceDateTime, formatInvoiceQuantity, invoiceValidUntil, tomanToPersianWords } from './_invoice-format'

describe('formatInvoiceQuantity', () => {
  test('uses Persian decimal separator', () => expect(formatInvoiceQuantity(40.32)).toBe('۴۰٫۳۲'))
  test('integers have no decimals', () => expect(formatInvoiceQuantity(12)).toBe('۱۲'))
  test('groups thousands', () => expect(formatInvoiceQuantity(1234.5)).toBe('۱٬۲۳۴٫۵'))
  test('rounds to 2 decimals', () => expect(formatInvoiceQuantity(2.456)).toBe('۲٫۴۶'))
})

describe('formatInvoiceDateTime', () => {
  test('Jalali, Tehran time, Persian comma', () =>
    expect(formatInvoiceDateTime('2026-11-24T09:42:00.000Z')).toBe('۱۴۰۵/۰۹/۰۳، ۱۳:۱۲'))
})

describe('invoiceValidUntil', () => {
  test('adds 24 hours', () =>
    expect(invoiceValidUntil('2026-11-24T09:42:00.000Z').toISOString()).toBe('2026-11-25T09:42:00.000Z'))
})

describe('tomanToPersianWords', () => {
  test('zero', () => expect(tomanToPersianWords(0)).toBe('صفر تومان'))
  test('teens', () => expect(tomanToPersianWords(15)).toBe('پانزده تومان'))
  test('hundreds', () => expect(tomanToPersianWords(320)).toBe('سیصد و بیست تومان'))
  test('sample total', () =>
    expect(tomanToPersianWords(42_032_600)).toBe('چهل و دو میلیون و سی و دو هزار و ششصد تومان'))
  test('billions', () =>
    expect(tomanToPersianWords(1_500_000_000)).toBe('یک میلیارد و پانصد میلیون تومان'))
  test('rejects negatives and non-integers', () => {
    expect(() => tomanToPersianWords(-1)).toThrow()
    expect(() => tomanToPersianWords(1.5)).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd apps/web && bun test src/modules/orders/order-invoice-modal/_invoice-format.test.ts`
Expected: FAIL — cannot resolve `./_invoice-format`.

- [ ] **Step 3: Implement `_invoice-format.ts`**

- `formatInvoiceQuantity`: module-level `new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 })`.
- `formatInvoiceDateTime`: module-level `new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tehran' })`, then replace `', '` with `'، '` (ICU emits a Latin comma — verified).
- `invoiceValidUntil`: `new Date(Date.parse(createdAt) + INVOICE_VALIDITY_HOURS * 3_600_000)`.
- `tomanToPersianWords`: throw `RangeError` unless `Number.isSafeInteger(amount) && amount >= 0`. Algorithm: split into 3-digit groups from the right; scales `['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون']`; each non-zero group → words for hundreds (`صد`,`دویست`,`سیصد`,`چهارصد`,`پانصد`,`ششصد`,`هفتصد`,`هشتصد`,`نهصد`), tens (`بیست`…`نود`), 10–19 (`ده`,`یازده`,`دوازده`,`سیزده`,`چهارده`,`پانزده`,`شانزده`,`هفده`,`هجده`,`نوزده`), ones (`یک`…`نه`) joined with `' و '`; append the scale word; join groups (most significant first) with `' و '`; suffix `' تومان'`.

- [ ] **Step 4: Run to verify pass**

Run: same command. Expected: all PASS.

- [ ] **Step 5: Commit** — `feat(web): add pre-invoice formatting helpers`

---

### Task 3: Typed order mapper without fabricated values

**Files:**
- Create: `apps/web/src/modules/orders/order-mapper.ts`
- Test: `apps/web/src/modules/orders/order-mapper.test.ts`
- Modify: `apps/web/src/modules/orders/order-store.ts` (move `buildFullOrderTimeline` lines ~21–140 and `mapDocToOrder` lines ~141–232 out; import them back)
- Modify: `packages/contract/src/order.ts` — add `export type CustomerOrderDocument = z.infer<typeof CustomerOrderDocumentSchema>` right after the schema (`index.ts` already does `export * from './order'`). In the new file import `formatGrade` from `@/modules/catalog/catalog-mapper` (side-effect-free source; `product-store` only re-exports it) and `catalogProductImages` from `@/lib/media-url`. Mapper must not import `api`, `queryClient` or stores, so the test can import it without side effects.

**Interfaces:**
- Consumes: `CustomerOrderDocument` from `@persianpart/contract`.
- Produces: `export function mapDocToOrder(doc: CustomerOrderDocument): Order` and `export function buildFullOrderTimeline(doc: CustomerOrderDocument, persianDate?: string, force60MinutesPassed?: boolean): TimelineStep[]` (existing optional params kept) in `@/modules/orders/order-mapper`. Callers (`order-store.ts` lines ~236, 243, 253, 267, 271) keep working; `acceptOrder(doc: unknown)` becomes `acceptOrder(doc: CustomerOrderDocument)`.

- [ ] **Step 1: Write the failing tests**

Build a minimal valid `CustomerOrderDocument` fixture (`id: 1`, `orderNumber: '1405090317'`, `status: 'pending'`, `warehouse: 1`, `user: { id: 1, fullName: 'رضا محمدی', phone: '09121234567' }`, one item `{ product: 7, productName: 'کاشی', requestedArea: 40, cartonCount: 28, deliverableArea: 40.32, unitPrice: 485000, totalPrice: 19555200 }`, `subtotal: 19555200`, `finalTotal: 19555200`, `createdAt/updatedAt: '2026-11-24T09:42:00.000Z'`).

```ts
test('copies item quantities verbatim', () => {
  expect(mapDocToOrder(doc).items[0]).toMatchObject({ cartonCount: 28, deliverableArea: 40.32, requestedArea: 40, unitPrice: 485000, totalPrice: 19555200 })
})
test('empty company name stays empty', () => expect(mapDocToOrder(doc).storeName).toBe(''))
test('null tax/discount become 0', () => expect(mapDocToOrder({ ...doc, taxAmount: null, discountAmount: null })).toMatchObject({ taxAmount: 0, discountAmount: 0 }))
test('finalTotal 0 is kept, not replaced by subtotal', () => expect(mapDocToOrder({ ...doc, finalTotal: 0 }).finalTotal).toBe(0))
test('missing notes become empty string', () => expect(mapDocToOrder({ ...doc, notes: null }).notes).toBe(''))
```

- [ ] **Step 2: Run to verify fail** — `cd apps/web && bun test src/modules/orders/order-mapper.test.ts` → FAIL (module missing).

- [ ] **Step 3: Move and type the mapper**

Move both functions verbatim into `order-mapper.ts`, then change only: parameter type `any` → `CustomerOrderDocument`; `(i: any)` → inferred; remove `|| 1` on `requestedArea`, `cartonCount`, `deliverableArea` and `|| 0` on `unitPrice`/`totalPrice` (schema guarantees them); `finalTotal: doc.finalTotal` (no `|| doc.subtotal`); `discountAmount: doc.discountAmount ?? 0`, `taxAmount: doc.taxAmount ?? 0`; `notes: doc.notes ?? ''`; `createdAt: doc.createdAt` (no `new Date()` fallback); `customerName: userObj?.fullName ?? ''`. Leave `deliveryAddress` fallback logic but drop the literal `'انبار مرکزی بازرگانی دهقان'` → `''`.

STOP condition: if `tsc` then reports errors outside `order-mapper.ts`, `order-store.ts`, `use-submit-order.ts`, `pre-invoice-modal.tsx`, stop and report them instead of fixing.

- [ ] **Step 4: Verify** — mapper tests PASS; `pnpm --filter @persianpart/web exec tsc --noEmit` exit 0; `pnpm --filter @persianpart/web test:unit` all PASS.

- [ ] **Step 5: Commit** — `refactor(web): type order mapper and stop fabricating item values`

---

### Task 4: Items table as a plain print-safe table

**Files:**
- Modify: `apps/web/src/modules/orders/order-invoice-modal/_invoice-items-table.tsx`
- Modify: `apps/web/src/styles/globals.css` (print block)

**Interfaces:**
- Consumes: `formatInvoiceQuantity` (Task 2), `formatCartons`, `formatUnit` from `@/lib/utils/unit`, `formatToman`, `toPersianDigits` from `@/lib/utils/currency`.

- [ ] **Step 1: Replace HeroUI `Table` with native markup**

`<table className="w-full table-fixed border-collapse text-xs print:text-[9.5px]">` with `<caption className="sr-only">اقلام پیش‌فاکتور</caption>`, `<thead>` row `bg-default-100`, `<th scope="col">` cells. Columns and widths, in this order:

| Header text (exact) | width | align |
| --- | --- | --- |
| `ردیف` | `w-[6%]` | `text-center` |
| `شرح کالا` | `w-[38%]` | `text-start` |
| `تعداد بسته` | `w-[13%]` | `text-center` |
| `مقدار` | `w-[13%]` | `text-center` |
| `فی (تومان)` | `w-[14%]` | `text-end` |
| `مبلغ (تومان)` | `w-[16%]` | `text-end` |

Body rows: `<tr className="border-b border-default-200 break-inside-avoid">`; product cell `<th scope="row" className="text-start font-bold break-words">` (row header = product, not the index). Quantity cell: `` `${formatInvoiceQuantity(item.deliverableArea)} ${item.productType === 'other' ? formatUnit(item.unit) : 'مترمربع'}` ``. Package cell: for `other` → `` `${toPersianDigits(item.cartonCount)} ${formatUnit(item.unit)}` ``, else `formatCartons(item.cartonCount, item.cartonsPerPallet)`. No `|| 1` anywhere. Row key: `` `${item.productId}-${idx}` ``. Wrapper keeps `overflow-x-auto` on screen with `min-w-[560px] sm:min-w-0 print:min-w-0`.

- [ ] **Step 2: Print CSS** — in `@media print` of `globals.css`: set `@page { size: A4 portrait; margin: 10mm; }`; add `#printable-invoice thead { display: table-header-group; }` and `#printable-invoice tr { break-inside: avoid; }`; delete the HeroUI-table override rules (`[data-slot="th"]`, `[role="columnheader"]`, `th::after`, first/last-child radius blocks).

- [ ] **Step 3: Verify** — `tsc --noEmit` exit 0; `grep -n "@heroui/react" src/modules/orders/order-invoice-modal/_invoice-items-table.tsx` → no output.

- [ ] **Step 4: Commit** — `refactor(web): render pre-invoice items as a native print-safe table`

---

### Task 5: Totals with amount in words

**Files:** Modify `apps/web/src/modules/orders/order-invoice-modal/_invoice-totals.tsx`

**Interfaces:** Consumes `tomanToPersianWords` (Task 2). Props unchanged.

- [ ] **Step 1: Implement**
- Drop the «خلاصه صورت‌حساب مالی» title bar and the `bg-foreground text-background` fill (ink-heavy, unreadable on B/W printers). Final row: `border-2 border-foreground rounded-xl px-3 py-2 font-extrabold`.
- Breakdown (only when `discountAmount > 0 || taxAmount > 0`): `جمع کالاها`, `تخفیف` (with `-`), `مالیات بر ارزش افزوده` (no `(۱۰٪)` — rate is not in the data).
- Final row label `مبلغ قابل پرداخت`, value `{formatToman(finalTotal)} تومان`.
- Below it: `<p className="text-[11px] text-muted print:text-[8.5px]">به حروف: {tomanToPersianWords(finalTotal)}</p>`.

- [ ] **Step 2: Verify** — `tsc --noEmit` exit 0.

- [ ] **Step 3: Commit** — `feat(web): show pre-invoice total in words and drop hard-coded VAT rate`

---

### Task 6: Header validity deadline and copy fixes

**Files:** Modify `_invoice-header.tsx`, `_invoice-terms.tsx`, `_invoice-action-bar.tsx`.

**Interfaces:** Consumes `formatInvoiceDateTime`, `invoiceValidUntil` (Task 2).

- [ ] **Step 1: Header** — `تاریخ صدور` value: `formatInvoiceDateTime(order.createdAt ?? order.date)`. Validity row label `معتبر تا`, value `formatInvoiceDateTime(invoiceValidUntil(order.createdAt))` (render row only when `order.createdAt` is set).
- [ ] **Step 2: Terms** — heading `شرایط:` (drop «رسمی»). First bullet exact: `• بارگیری و تحویل کالا پس از تأیید پرداخت انجام می‌شود.` Second bullet unchanged. Keep notes block.
- [ ] **Step 3: Action bar** — title `پیش‌فاکتور سفارش` (drop «رسمی»); remove the non-existent `dir-ltr` class.
- [ ] **Step 4: Verify** — `tsc --noEmit` exit 0; `grep -rn "dir-ltr\|رسمی" src/modules/orders/order-invoice-modal` → no output.
- [ ] **Step 5: Commit** — `fix(web): show pre-invoice expiry time and drop "official" wording`

---

### Task 7: Modal accessibility and print title

**Files:** Modify `order-invoice-modal.tsx`.

- [ ] **Step 1: Dialog semantics** — overlay `motion.div` gets `role="dialog"`, `aria-modal="true"`, `aria-labelledby="invoice-title"`; the `<h1>` in `_invoice-header.tsx` gets `id="invoice-title"`.
- [ ] **Step 2: Escape + scroll lock** — one `useEffect` keyed on `isOpen`: when open, add `keydown` listener calling `onClose()` on `Escape`, and set `document.body.style.overflow = 'hidden'`; cleanup removes the listener and restores the previous overflow value. Hooks must run before the `if (!order) return null` early return.
- [ ] **Step 3: Print title** — replace the `setTimeout(..., 1000)` restore with `window.addEventListener('afterprint', restore, { once: true })` registered before `window.print()`.
- [ ] **Step 4: Verify** — `tsc --noEmit` exit 0; run `pnpm --filter @persianpart/web dev --port 5173`, open an order → «پیش‌فاکتور», press Escape → modal closes; background does not scroll while open.
- [ ] **Step 5: Commit** — `fix(web): make pre-invoice modal an accessible dialog`

---

### Task 8: Stop printing a system note as customer notes

**Files:** Modify `apps/web/src/modules/checkout/pre-invoice-modal.tsx` (~line 125).

- [ ] **Step 1** — remove `notes: "ثبت سفارش از لیست محصولات",` from the `mutateAsync` payload (`notes` is optional in `SubmitOrderInputSchema`). Keep the `submissionKey(...)` label argument unchanged.
- [ ] **Step 2: Verify** — `tsc --noEmit` exit 0; `pnpm --filter @persianpart/web test:unit` PASS.
- [ ] **Step 3: Commit** — `fix(web): stop sending a fixed system note with new orders`

Note: existing orders keep the old note; no data migration in this plan.

---

### Task 9: Final verification

- [ ] `pnpm --filter @persianpart/web exec tsc --noEmit` → exit 0
- [ ] `pnpm --filter @persianpart/web test:unit` → all PASS
- [ ] `pnpm --filter @persianpart/web build` → success
- [ ] Dev server: open an order with ≥ 3 items, press «چاپ / ذخیره PDF», save PDF. Check: one A4 page per ~20 rows, header repeats on page 2 (test with a 30-item order if available), no Latin digits except SKUs, `٫` decimals, total in words matches the number, Escape closes the modal.
- [ ] Report results; do not claim success for any unchecked line.

## Open questions for the human (not in scope)

1. Logo still `/assets/images/persian-part-logo.png` (PersianPart) under the name «بازرگانی زمانیان» — replace?
2. Seller contact block (phone, address, economic code) — no data source exists; provide values?
3. Buyer economic code exists on the user profile (`economicCode`) but not in `CustomerOrderDocumentSchema` — add to the contract?
4. App-wide `formatToman` uses Latin `,` grouping — switch globally to `٬`?
