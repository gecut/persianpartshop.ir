# Stock Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One admin page («موجودی انبارها») where the accountant uploads a Kimia/stock file, sees errors and a preview, optionally zeroes products missing from the file, edits numeric balances inline, and ticks or unticks factory inquirability per product.

**Architecture:** A client board component is mounted with `beforeListTable` on the `warehouse-stock` collection. It composes the existing `StockImport` upload box and a new paginated table. Reads come from a new `GET /api/warehouse-stock/board`. Numeric writes reuse `POST /api/warehouse-stock/for-product/:productId`. Inquiry writes use a new `POST /api/warehouse-stock/inquiry`. The import preview gains an opt-in `zeroMissing`. There is no DB schema change.

**Tech Stack:** Payload CMS 3.90 (Next 16), `@payloadcms/db-postgres` `sql`, Zod (in `@persianpart/contract`), React 19 client components with CSS modules, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-28-stock-board-design.md`. Read it first.

## Global Constraints

- Package manager `pnpm`. CMS tests: `pnpm --filter @persianpart/cms test:unit`. CMS typecheck: `pnpm --filter @persianpart/cms exec tsc --noEmit`.
- **No migration, no `ALTER`, no `UPDATE` outside the code paths named here.** Never run `migrate`, `migrate:fresh`, `migrate:down` or `seed` against any database.
- **Do not commit.** The repo forbids unrequested commits (AGENTS.md §7). Leave changes in the working tree.
- Every write path is guarded by `manageWarehouses` and runs inside `initTransaction`/`commitTransaction`/`killTransaction`, using `getTransactionDb(req)` for raw SQL. It writes exactly one `audit-logs` row per request (inquiry) or per cell (existing `for-product`).
- Lock order inside a transaction: warehouse row (`FOR SHARE`), then products sorted by id, then `warehouse_stock` rows sorted by product id. This matches `applyStockImport` and `reserveWarehouseStock`.
- API shapes (Zod schemas and response types) live in `packages/contract/src/warehouse.ts`. The CMS imports them from `@persianpart/contract`. Never redeclare them.
- Files are kebab-case. Module-private files start with `_`. Named exports only. No barrel files. No `any`.
- UI is RTL Persian (`dir="rtl"`). Numbers use `toLocaleString('fa-IR')`. SKUs are wrapped in `<bdi>`. Use CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-start`), never left/right.
- Every new `*.test.ts` file must be appended to the `test:unit` script in `apps/cms/package.json` (it lists files explicitly).
- After adding or renaming any admin component path, run `pnpm --filter @persianpart/cms generate:importmap`.

## Review Focus

1. A file row that is invalid or duplicated (e.g. bad number) must NOT have its product zeroed by `zeroMissing`. Its SKU "appears" in the file. Test: `computeMissingRows` excludes SKUs from `errorSkus`.
2. `zeroMissing` must ignore inactive warehouses, inquiry warehouses and balances already at 0. Only `inventory_sqm > 0` rows of the chosen exact warehouse become rows. Test in Task 1.
3. Search text containing `%`, `_` or `\` must match literally, not as a wildcard. Test: `escapeLike('50%_a\\')` → `'50\\%\\_a\\\\'`.
4. Inquiry body with duplicate productIds, or more than 500 changes, or a non-inquiry warehouse, must be rejected before any write. Tests: `parseInquiryBody` null cases (Task 2). The warehouse check runs inside the transaction.
5. Navigating to another page or changing a filter while there are unsaved edits must not silently drop them. The board asks for `window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')`. Pure helper `hasDirty` is tested in Task 3.

---

### Task 1: Import `zeroMissing` option (contract + server + upload box)

**Files:**
- Modify: `packages/contract/src/warehouse.ts:29-50`
- Create: `apps/cms/src/collections/warehouse-stock/_missing-rows.ts`
- Create: `apps/cms/src/collections/warehouse-stock/_missing-rows.test.ts`
- Modify: `apps/cms/src/collections/warehouse-stock/_import.endpoints.ts` (`getStockImportPreview`)
- Modify: `apps/cms/src/collections/warehouse-stock/components/stock-import.tsx`
- Modify: `apps/cms/package.json` (`test:unit` list)

**Interfaces:**
- Produces (contract):
  - `StockImportRowSchema` gains `missingFromFile: z.literal(true).optional()`. `rowNumber` changes from `.positive()` to `.nonnegative()` (missing rows use `rowNumber: 0`).
  - `StockImportPreviewInputSchema` gains `zeroMissing: z.boolean().default(false)`. The refine also rejects `zeroMissing === true` when `mode === 'price'`.
  - `StockImportSnapshotSchema.rows` max changes from `1000` to `2000`. In `superRefine`, the price requirement (`mode !== 'stock' && basePricePerSqm === undefined`) is skipped when `row.missingFromFile`.
  - `StockImportPreview` type gains `missingCount: number`.
- Produces (cms): `computeMissingRows(input: { fileSkus: ReadonlySet<string>; balances: readonly MissingBalance[] }): MissingBalance[]` where `type MissingBalance = { productId: number; sku: string; name: string; productUpdatedAt: string; inventorySqm: number; revision: number }`. It returns the balances whose `sku` is not in `fileSkus` and whose `inventorySqm > 0`, sorted by `productId` ascending.

- [ ] **Step 1: Write the failing test** `_missing-rows.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeMissingRows } from './_missing-rows'

const b = (productId: number, sku: string, inventorySqm: number) => ({ productId, sku, name: `n${productId}`, productUpdatedAt: '2026-11-01T00:00:00.000Z', inventorySqm, revision: 3 })

test('keeps only positive balances whose SKU is absent from the file, sorted by product id', () => {
  const result = computeMissingRows({ fileSkus: new Set(['A']), balances: [b(9, 'C', 5), b(2, 'A', 7), b(4, 'B', 0), b(3, 'D', 0.01)] })
  assert.deepEqual(result.map(r => r.productId), [3, 9])
})

test('a SKU present only in an invalid or duplicate file row still counts as present', () => {
  // caller passes every SKU seen in the file, valid or not
  assert.deepEqual(computeMissingRows({ fileSkus: new Set(['A', 'BAD']), balances: [b(1, 'BAD', 10)] }), [])
})
```

- [ ] **Step 2: Run** `pnpm --filter @persianpart/cms exec tsx --test src/collections/warehouse-stock/_missing-rows.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `computeMissingRows`** in `_missing-rows.ts`, exporting `MissingBalance` and the function. Pure, no imports.

- [ ] **Step 4: Run the test again.** Expected: PASS (2 tests).

- [ ] **Step 5: Update the contract** in `packages/contract/src/warehouse.ts` exactly as in the Interfaces block. Keep every existing field and refinement.

- [ ] **Step 6: Wire `getStockImportPreview`** (`_import.endpoints.ts`):
  - Build `fileSkus` from **all** parsed records, valid and error rows (`parsed.rows.map(r => r.sku)` plus `parsed.errors.map(e => e.sku)`, ignoring empty strings).
  - When `input.zeroMissing && input.mode !== 'price'`, load the candidates with one query on the request's DB (`await getTransactionDb(req)`; no lock is needed at preview):

    ```sql
    SELECT ws.product_id, ws.inventory_sqm, ws.revision, p.sku, p.name, p.updated_at
    FROM warehouse_stock ws JOIN products p ON p.id = ws.product_id
    WHERE ws.warehouse_id = ${input.warehouseId} AND ws.inventory_sqm > 0
    ```

  - Map the result to `MissingBalance`: `Number(...)` for numerics and `new Date(String(updated_at)).toISOString()` for `productUpdatedAt`. Call `computeMissingRows`. Append each result to `rows` as `{ rowNumber: 0, sku, name, productId, productUpdatedAt, inventorySqm: 0, previousInventory: inventorySqm, revision, previousPrice: null, missingFromFile: true }`.
  - If `rows.length > 2000`, throw `new Error('تعداد ردیف‌های قابل ثبت بیش از ۲۰۰۰ است؛ فایل را کوچک‌تر کنید.')`.
  - Put `zeroMissing` nowhere in the snapshot; the rows carry it. Return `missingCount: rows.filter(r => r.missingFromFile).length`.
  - `applyStockImport` needs no change. Confirm by reading it: missing rows have `basePricePerSqm` undefined, so price is skipped, and `revision` is non-null, so `replaceWarehouseStock` runs with the revision check.

- [ ] **Step 7: Upload box** (`stock-import.tsx`):
  - Add state `zeroMissing` (boolean, default `false`, reset to `false` when the mode changes).
  - When `needsWarehouse`, render a checkbox labelled `کالاهای خارج از فایل در این انبار صفر شوند` with hint `فقط کالاهایی که موجودی مثبت دارند و کدشان در فایل نیست.`.
  - Send `zeroMissing` in the preview body only when `mode !== 'price'`. Changing it clears `preview`.
  - In the preview header, append `، صفرشونده (خارج از فایل): {format(preview.missingCount)}`.
  - In the rows table, render `خارج از فایل` in the «ردیف» cell when `row.missingFromFile`, instead of the number.

- [ ] **Step 8: Add the test file to `test:unit`** and run `pnpm --filter @persianpart/cms test:unit`. Expected: all pass.

- [ ] **Step 9: Typecheck.** Run `pnpm --filter @persianpart/cms exec tsc --noEmit` and `pnpm --filter @persianpart/api exec tsc --noEmit`. Expected: no errors. The API must still compile against the changed contract.

---

### Task 2: Board read endpoint and bulk inquiry endpoint

**Files:**
- Modify: `packages/contract/src/warehouse.ts` (append the schemas below)
- Create: `apps/cms/src/collections/warehouse-stock/_board-query.ts`
- Create: `apps/cms/src/collections/warehouse-stock/_board-query.test.ts`
- Create: `apps/cms/src/collections/warehouse-stock/_board.endpoints.ts`
- Modify: `apps/cms/src/collections/warehouse-stock/warehouse-stock.collection.ts` (`endpoints` array)
- Modify: `apps/cms/package.json` (`test:unit` list)

**Interfaces:**
- Produces (contract, `warehouse.ts`):
  ```ts
  export const StockBoardFilterSchema = z.enum(['all', 'in_stock', 'out_of_stock', 'inquiry', 'not_inquiry'])
  export const StockInquiryUpdateInputSchema = z.object({
    warehouseId: z.number().int().positive().safe(),
    changes: z.array(z.object({ productId: z.number().int().positive().safe(), enabled: z.boolean() }).strict()).min(1).max(500),
  }).strict().refine(v => new Set(v.changes.map(c => c.productId)).size === v.changes.length)
  export type StockBoardFilter = z.infer<typeof StockBoardFilterSchema>
  export type StockBoardCell = { amount: number | null; revision: number; isActive: boolean; lastReportedAt: string | null }
  export type StockBoardRow = { productId: number; sku: string; name: string; productType: 'tile' | 'other'; unit: string | null; salesFactor: number | null; basePricePerSqm: number | null; isActive: boolean; cells: Record<string, StockBoardCell | null> }
  export type StockBoardWarehouse = { id: number; code: string; name: string; stockMode: 'exact' | 'inquiry' }
  export type StockBoardResponse = { warehouses: StockBoardWarehouse[]; rows: StockBoardRow[]; page: number; limit: number; totalDocs: number; totalPages: number }
  export type StockInquiryUpdateResult = { enabled: number; disabled: number }
  ```
  `cells` is keyed by `String(warehouseId)`, with one key per returned warehouse. `null` means no row. `salesFactor` is `null` when `getSalesFactor` throws (invalid carton). In that case the UI shows no carton hint.
- Produces (cms `_board-query.ts`):
  - `type BoardQuery = { q: string; category: number | null; brand: number | null; filter: StockBoardFilter; page: number; limit: 25 | 50 | 100 }`
  - `parseBoardQuery(params: URLSearchParams): BoardQuery | null`. Defaults: `q=''`, `filter='all'`, `page=1`, `limit=50`. `q` is trimmed, max 100 chars, else null. `category`/`brand` are positive safe ints or absent. `page` is an int in `1..100000`. `limit` is one of 25/50/100. Any invalid value → `null`.
  - `escapeLike(text: string): string` escapes `\`, `%`, `_` with a backslash.
  - `parseInquiryBody(body: unknown): { warehouseId: number; changes: { productId: number; enabled: boolean }[] } | null` wraps `StockInquiryUpdateInputSchema.safeParse` and returns changes sorted by `productId`.
- Produces (endpoints): `GET /api/warehouse-stock/board` → `StockBoardResponse`, and `POST /api/warehouse-stock/inquiry` → `StockInquiryUpdateResult`. Both use exported `boardEndpoints: Endpoint[]`.

- [ ] **Step 1: Write the failing test** `_board-query.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeLike, parseBoardQuery, parseInquiryBody } from './_board-query'

test('parseBoardQuery defaults and validation', () => {
  assert.deepEqual(parseBoardQuery(new URLSearchParams('')), { q: '', category: null, brand: null, filter: 'all', page: 1, limit: 50 })
  assert.deepEqual(parseBoardQuery(new URLSearchParams('q=%20abc%20&category=3&brand=4&filter=inquiry&page=2&limit=100')), { q: 'abc', category: 3, brand: 4, filter: 'inquiry', page: 2, limit: 100 })
  for (const bad of ['filter=x', 'page=0', 'page=1.5', 'limit=30', 'category=-1', 'brand=abc', `q=${'a'.repeat(101)}`]) assert.equal(parseBoardQuery(new URLSearchParams(bad)), null, bad)
})

test('escapeLike makes wildcards literal', () => {
  assert.equal(escapeLike('50%_a\\'), '50\\%\\_a\\\\')
})

test('parseInquiryBody rejects duplicates, oversize and bad shapes; sorts by product', () => {
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: [] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: [{ productId: 2, enabled: true }, { productId: 2, enabled: false }] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: Array.from({ length: 501 }, (_, i) => ({ productId: i + 1, enabled: true })) }), null)
  assert.equal(parseInquiryBody({ warehouseId: 0, changes: [{ productId: 1, enabled: true }] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: [{ productId: 1, enabled: 'yes' }] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, extra: 1, changes: [{ productId: 1, enabled: true }] }), null)
  assert.deepEqual(parseInquiryBody({ warehouseId: 1, changes: [{ productId: 9, enabled: false }, { productId: 3, enabled: true }] }), { warehouseId: 1, changes: [{ productId: 3, enabled: true }, { productId: 9, enabled: false }] })
})
```

- [ ] **Step 2: Run it.** Command: `pnpm --filter @persianpart/cms exec tsx --test src/collections/warehouse-stock/_board-query.test.ts`. Expected: FAIL.

- [ ] **Step 3: Add the contract schemas and types**, then implement `_board-query.ts`. It imports only from `@persianpart/contract`.

- [ ] **Step 4: Run the test.** Expected: PASS (3 tests).

- [ ] **Step 5: Implement `readStockBoard(req: PayloadRequest, query: BoardQuery): Promise<StockBoardResponse>`** in `_board.endpoints.ts`.
  - Guard: `if (!await manageWarehouses({ req })) throw businessError('دسترسی مجاز نیست.', 'FORBIDDEN', 403)`.
  - Id page via raw SQL with `const db = await getTransactionDb(req)`. Build the filter fragment with drizzle `sql` composition (`sql\`\`` fragments interpolated into the outer `sql`; use `sql\`TRUE\`` for "no condition"):
    ```sql
    -- exactStock(p) := EXISTS (SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id = s.warehouse_id
    --   WHERE s.product_id = p.id AND w.is_active AND w.stock_mode = 'exact' AND s.is_active AND s.inventory_sqm > 0)
    -- inquirable(p) := EXISTS (SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id = s.warehouse_id
    --   WHERE s.product_id = p.id AND w.is_active AND w.stock_mode = 'inquiry' AND s.is_active)
    SELECT p.id, COUNT(*) OVER() AS total FROM products p
    WHERE (${q} = '' OR p.name ILIKE ${pattern} ESCAPE '\' OR p.sku ILIKE ${pattern} ESCAPE '\')
      AND (${category}::int IS NULL OR p.category_id = ${category}::int)
      AND (${brand}::int IS NULL OR p.brand_id = ${brand}::int)
      AND <filter: all→TRUE, in_stock→exactStock, out_of_stock→NOT exactStock, inquiry→inquirable, not_inquiry→NOT inquirable>
    ORDER BY p.name, p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}
    ```
    Here `pattern = '%' + escapeLike(q) + '%'`. `totalDocs = Number(rows[0]?.total ?? 0)`. When the page is past the end, `rows` is empty and `totalDocs` is 0. In that case run `SELECT COUNT(*)` with the same WHERE only if `page > 1`. Simpler accepted alternative: always run a separate `COUNT(*)` query with the same fragment. Pick one and keep it consistent.
  - Then use `Promise.all` for:
    - `payload.find` on `products`, `where: { id: { in: ids } }`, `pagination: false`, `depth: 0`, `select: { sku, name, productType, unit, sqmPerCarton, basePricePerSqm, isActive }`, `overrideAccess: false`.
    - `payload.find` on `warehouses`, `where: { isActive: { equals: true } }`, `sort: ['name','id']`, `pagination: false`, `select: { code, name, stockMode }`.
    - `payload.find` on `warehouse-stock`, `where: { product: { in: ids } }`, `pagination: false`, `depth: 0`, `select: { product, warehouse, inventorySqm, revision, isActive, lastReportedAt }`.

    Skip the product and balance queries when `ids` is empty.
  - Keep the SQL order of `ids` in the output. Fill `cells[String(w.id)]` for every active warehouse, defaulting to `null`. `totalPages = Math.max(1, Math.ceil(totalDocs / limit))`.

- [ ] **Step 6: Implement `updateInquiry(req: PayloadRequest, body: unknown): Promise<StockInquiryUpdateResult>`** in the same file.
  - Guard as in Step 5, plus `req.user` must be present. `parseInquiryBody`, else `businessError('ورودی نامعتبر است.', 'INVALID_INPUT', 400)`.
  - `const started = await initTransaction(req)`. Inside `try`:
    1. `SELECT name FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'inquiry' FOR SHARE`. If no row → `businessError('انبار استعلامی فعال نیست.', 'WAREHOUSE_UNAVAILABLE', 409)`.
    2. `SELECT id FROM products WHERE id = ANY(${ids}::int[]) ORDER BY id FOR SHARE`. If the count differs → `businessError('برخی کالاها یافت نشدند.', 'PRODUCT_NOT_FOUND', 404)`. Pass `ids` as a Postgres array literal: `sql\`ARRAY[${sql.join(ids.map(id => sql\`${id}\`), sql\`, \`)}]::int[]\``.
    3. For each change, in sorted order:
       - Run `SELECT id, is_active FROM warehouse_stock WHERE warehouse_id = ${warehouseId} AND product_id = ${productId} FOR UPDATE`.
       - Missing row and `enabled` → `req.payload.create({ collection: 'warehouse-stock', data: { warehouse: warehouseId, product: productId, inventorySqm: null, revision: 0, isActive: true, lastReportedAt: new Date().toISOString() }, req, overrideAccess: false })`. Count it as enabled.
       - Missing row and not `enabled` → skip.
       - Existing row with `is_active === enabled` → skip.
       - Otherwise → `req.payload.update({ collection: 'warehouse-stock', id, data: enabled ? { isActive: true, lastReportedAt: new Date().toISOString() } : { isActive: false }, req, overrideAccess: false })`. Count it as enabled or disabled.
    4. If `enabled + disabled > 0`, write one audit log: `req.payload.create({ collection: 'audit-logs', req, overrideAccess: true, data: { action: 'other', entity: 'products', admin: Number(req.user.id), adminName: 'name' in req.user ? String(req.user.name) : '', target: \`قابلیت استعلام — ${name} (شناسهٔ ${warehouseId})\`, details: \`فعال‌شده: ${enabled}، غیرفعال‌شده: ${disabled}، شناسه کالاها: ${changedIds.join(',')}\` } })`.
    5. `commitTransaction` and return `{ enabled, disabled }`.
  - `catch`: `killTransaction`. A unique-violation on constraint `warehouse_product_idx` (walk `.cause` up to 5 levels, the same way `adjustProductStock` does) → `businessError('این ردیف هم‌زمان ایجاد شده است؛ صفحه را تازه کنید.', 'STALE_STOCK')`. Rethrow public `APIError`. Otherwise rethrow.

- [ ] **Step 7: Export `boardEndpoints`.**
  - `GET` `/board` handler: `parseBoardQuery(new URL(req.url!).searchParams)`. On null, return `Response.json({ error: 'پارامترهای جستجو نامعتبر است.' }, { status: 400 })`. Otherwise return `Response.json(await readStockBoard(req, query), { headers: { 'Cache-Control': 'private, no-store' } })`.
  - `POST` `/inquiry` handler: `Response.json(await updateInquiry(req, await req.json?.().catch(() => undefined)))`.
  - Register in `warehouse-stock.collection.ts` as `endpoints: [...stockImportEndpoints, ...productStockEndpoints, ...boardEndpoints]`.

- [ ] **Step 8: Add the test file to `test:unit`.** Run `pnpm --filter @persianpart/cms test:unit`, then `pnpm --filter @persianpart/cms exec tsc --noEmit`. Expected: pass and no errors.

- [ ] **Step 9: Manual smoke test (only if a local dev DB is already configured; never production).**
  - Run `pnpm --filter @persianpart/cms dev`, log in as a manager, then open `/api/warehouse-stock/board?limit=25` and `/api/warehouse-stock/board?filter=bad`.
  - Expected: JSON with `warehouses` (both modes) and 25 `rows`. The bad filter returns 400.
  - If there is no local DB, say so in the report and skip. Do not point at production.

---

### Task 3: Board UI

**Files:**
- Create: `apps/cms/src/collections/warehouse-stock/components/stock-board/stock-board.tsx` (exports `StockBoard`; composes `<StockImport onApplied={reload} />` above the table)
- Create: `.../stock-board/_board-filters.tsx` (search input, category/brand selects, filter select, page size)
- Create: `.../stock-board/_board-table.tsx` (table, cells, page-level inquiry bulk buttons, pager)
- Create: `.../stock-board/_dirty.ts` (pure edit-state helpers)
- Create: `.../stock-board/_dirty.test.ts`
- Create: `.../stock-board/stock-board.module.css`
- Modify: `components/stock-import.tsx` (add optional prop `onApplied?: () => void`, called after a successful apply, next to `router.refresh()`)
- Modify: `warehouse-stock.collection.ts` → `beforeListTable: ['/collections/warehouse-stock/components/stock-board/stock-board#StockBoard']`
- Modify: `apps/cms/package.json` (`test:unit`)

**Interfaces:**
- Consumes: `StockBoardResponse`, `StockBoardRow`, `StockBoardCell`, `StockBoardFilter`, `StockInquiryUpdateResult` from `@persianpart/contract`. Also `GET {api}/warehouse-stock/board`, `POST {api}/warehouse-stock/inquiry`, and `POST {api}/warehouse-stock/for-product/:productId` with body `{ warehouseId, revision: number | null, amount: number | null }`. Its errors come back as JSON `{ errors: [{ message }] }` (Payload `APIError`). Read `message` from `data.errors?.[0]?.message ?? data.error`.
- Produces (`_dirty.ts`):
  ```ts
  export type DirtyKey = `${number}:${number}` // `${productId}:${warehouseId}`
  export type DirtyState = { amounts: Record<DirtyKey, string>; inquiry: Record<DirtyKey, boolean> }
  export const emptyDirty: DirtyState
  export function dirtyKey(productId: number, warehouseId: number): DirtyKey
  export function setAmount(state: DirtyState, key: DirtyKey, text: string, original: number | null): DirtyState // removes key when Number(text) === original (text non-empty), keeps raw text otherwise
  export function setInquiry(state: DirtyState, key: DirtyKey, checked: boolean, original: boolean): DirtyState // removes key when checked === original
  export function hasDirty(state: DirtyState): boolean
  export function parseAmount(text: string): number | null // /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/ and <= 1_000_000_000, else null
  export function inquiryBatches(state: DirtyState): { warehouseId: number; changes: { productId: number; enabled: boolean }[] }[] // grouped by warehouse, chunked to 500, sorted
  ```
  "original" for inquiry is `cell?.isActive === true`. For an amount it is `cell?.amount ?? null`. Build API URLs from `useConfig().config.routes.api` (import `useConfig` from `@payloadcms/ui`), as `product-warehouse-stock.tsx` does.

- [ ] **Step 1: Write `_dirty.test.ts`**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirtyKey, emptyDirty, hasDirty, inquiryBatches, parseAmount, setAmount, setInquiry } from './_dirty'

test('amount edits that return to the original are dropped', () => {
  const k = dirtyKey(5, 2)
  let s = setAmount(emptyDirty, k, '12.5', 10)
  assert.equal(s.amounts[k], '12.5'); assert.ok(hasDirty(s))
  s = setAmount(s, k, '10', 10)
  assert.equal(hasDirty(s), false)
})

test('inquiry toggles back to original are dropped; batches group, sort and chunk', () => {
  let s = setInquiry(emptyDirty, dirtyKey(9, 1), true, false)
  s = setInquiry(s, dirtyKey(3, 1), false, true)
  s = setInquiry(s, dirtyKey(4, 7), true, false)
  assert.deepEqual(inquiryBatches(s), [
    { warehouseId: 1, changes: [{ productId: 3, enabled: false }, { productId: 9, enabled: true }] },
    { warehouseId: 7, changes: [{ productId: 4, enabled: true }] },
  ])
  assert.equal(hasDirty(setInquiry(s, dirtyKey(9, 1), false, false)) , true)
  let big = emptyDirty
  for (let i = 1; i <= 501; i++) big = setInquiry(big, dirtyKey(i, 1), true, false)
  assert.deepEqual(inquiryBatches(big).map(b => b.changes.length), [500, 1])
})

test('parseAmount accepts two decimals only', () => {
  assert.equal(parseAmount('0'), 0); assert.equal(parseAmount('.5'), 0.5); assert.equal(parseAmount('12.34'), 12.34)
  for (const bad of ['', '-1', '1.234', 'abc', '1e3', '1000000001']) assert.equal(parseAmount(bad), null, bad)
})
```

- [ ] **Step 2: Run it.** Command: `pnpm --filter @persianpart/cms exec tsx --test src/collections/warehouse-stock/components/stock-board/_dirty.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `_dirty.ts`** (pure, immutable updates). **Step 4:** run the test. Expected: PASS.

- [ ] **Step 5: Implement the components.**

  `stock-board.tsx` (`'use client'`, `export function StockBoard()`):
  - State: `query` (BoardQuery-like object, same defaults as Task 2), `data: StockBoardResponse | null`, `dirty: DirtyState`, `busy`, `message`, `error`, `failures: Record<DirtyKey, string>`.
  - Fetch `board?` + URLSearchParams on `query` change. Use an `active` flag in the effect to ignore stale responses (same pattern as `stock-import.tsx`). Search input is debounced 300 ms inside `_board-filters.tsx`.
  - Changing `query` while `hasDirty(dirty)` → `window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')`. On cancel, keep the old query. On OK, reset `dirty`.
  - Category/brand options load once from `{api}/categories?limit=1000&depth=0&sort=name` and `{api}/brands?limit=1000&depth=0&sort=name`, using `docs[].id/name`.
  - Save button `ذخیره تغییرات ({n})`, disabled when not dirty or busy:
    1. For each `inquiryBatches(dirty)` batch, `POST inquiry`. On error, stop and show the message.
    2. Then for each amount key, sequentially:
       - Run `parseAmount`. Invalid → record failure `مقدار نامعتبر است.` and continue.
       - Else `POST for-product/{productId}` with `{ warehouseId, revision: cell?.revision ?? null, amount }`. Record any failure message per key.
    3. Remove succeeded keys from `dirty` and keep failed ones. Reload the board. Show `ذخیره شد: {ok}، ناموفق: {failed}`.
  - Discard button `لغو تغییرات` resets `dirty` and `failures`.
  - `StockImport onApplied` → reload the board (bump a `reload` counter).
  - Warn on tab close while dirty: a `beforeunload` listener inside an effect keyed by `hasDirty(dirty)`. Clean it up on unmount.

  `_board-table.tsx` (props only, no fetching):
  - Columns: `کالا / کد` (name · `<bdi>sku</bdi>`; inactive product gets a `غیرفعال` badge), `قیمت پایه (تومان)` (read-only), then one column per warehouse in response order. Each warehouse header shows its name and `عددی`/`استعلامی`.
  - Exact cell:
    - `<input inputMode="decimal" dir="ltr">` showing the dirty text or the `amount` (empty string for null), with `aria-label={\`موجودی ${name} در ${warehouse.name}\`}`.
    - Under it, a carton hint when `productType === 'tile' && salesFactor`: `≈ {Math.floor(Math.round(value*100)/Math.round(salesFactor*100)).toLocaleString('fa-IR')} کارتن`.
    - Dirty cells get a highlight class. A failure message shows under the cell with `role="alert"`.
    - Cell with `isActive === false` → disabled input with title `ردیف غیرفعال است`.
  - Inquiry cell: checkbox labelled `قابل استعلام`, checked = dirty value ?? `cell?.isActive === true`. When `cell?.lastReportedAt` is set and the box is checked, show it under the box with `Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' })`.
  - Inquiry column header has two buttons, `همه این صفحه ✓` and `همه این صفحه ✗`, that call `setInquiry` for every row on the page.
  - Empty state: `کالایی با این شرایط یافت نشد.`
  - Pager: `صفحه {page} از {totalPages}` with previous/next buttons. Mobile: the table sits in a horizontally scrollable wrapper (`overflow-x: auto`); the page itself never scrolls horizontally.

  `_board-filters.tsx`: controlled inputs. Filter labels: `همه`, `موجود در انبار عددی`, `ناموجود در انبار عددی`, `قابل استعلام`, `غیرقابل استعلام`. Page size: 25/50/100.

  CSS (`stock-board.module.css`): reuse the visual language of `stock-import.module.css` (open it and copy its variable usage, e.g. `var(--theme-elevation-…)`). Logical properties only. A sticky first column uses `inset-inline-start: 0`.

- [ ] **Step 6: Point `beforeListTable` at `StockBoard`** and run `pnpm --filter @persianpart/cms generate:importmap`. Expected: `src/app/(payload)/admin/importMap.js` now references `stock-board#StockBoard`. `StockImport` stays importable and is rendered by `StockBoard`.

- [ ] **Step 7: Add the test file to `test:unit`.** Run `pnpm --filter @persianpart/cms test:unit` and `pnpm --filter @persianpart/cms exec tsc --noEmit`. Expected: pass and no errors.

- [ ] **Step 8: Build.** Run `pnpm --filter @persianpart/cms build`. Expected: build succeeds. If it fails for reasons unrelated to these files (e.g. missing env), report the exact error line and do not "fix" env or config.

---

### Task 4: Documentation

**Files:**
- Modify: `docs/operations/runbook.md` («Price and stock CSV» and «Warehouse stock import details» sections)
- Modify: `docs/product/business-rules.md` (R12)
- Modify: `docs/product/domain-models.md` (the supply-sources sentence in «Warehouses and sellable stock»)

- [ ] **Step 1: Runbook.** Describe the board: one row per product, one column per active warehouse, inline numeric edit (per-cell revision check and audit), «قابل استعلام» checkbox (batch, one audit per save), page-level bulk tick, and filters. Describe `zeroMissing`: opt-in, only positive balances of the chosen exact warehouse whose SKU is absent from the file, shown in the preview as «خارج از فایل», same signed apply. Replace «Create an inquiry warehouse and activate a supply source for each product manually» with the board checkbox.
- [ ] **Step 2: R12.** Add one sentence: with «صفر کردن کالاهای خارج از فایل», absent positive balances become 0 in the same transaction. Default off.
- [ ] **Step 3: domain-models.** State that inquirability is an active `warehouse_stock` row with null amount in an inquiry warehouse. The `supply-sources` collection file is unregistered legacy (table `supply_sources_legacy`).
- [ ] **Step 4:** Verify the links resolve with `grep -n "](../" docs/operations/runbook.md`. Every target path must exist.
