# Stock Board (موجودی انبارها) — Design

Date: 2026-11-28. Status: approved in conversation (owner asked for the plan directly).

## Intent

The accountant (a `manager` admin) refreshes sellable stock every working day from a Kimia export and decides which products may be inquired from the factory. Today this means one upload panel for numbers plus opening each product to make it "inquirable". Goal: one page where every product is a row and every active warehouse is a column, with the upload box on top. The simplest structure that covers the daily routine.

## Facts this design rests on (verified in code/data, 2026-11-28)

- Inquirability lives in `warehouse_stock`: a row in an `inquiry` warehouse with `inventory_sqm = NULL` and `is_active = true` means "can be inquired" (migration `20261109_140000_supply_simplification`). `apps/cms/src/collections/supply-sources/supply-sources.collection.ts` is NOT registered in `payload.config.ts`; its table was renamed to `supply_sources_legacy`. Readers: `supply-requests.collection.ts` (submit check), `apps/api/src/routers/warehouse-stock.helpers.ts` (`hasSupplySource`), `catalog-query-sql.ts`, `catalog-browse.endpoint.ts`.
- Production: 668 products; warehouses `factory` (id 1, inquiry, 513 rows) and `mashhad` (id 2, exact).
- `POST /api/warehouse-stock/for-product/:productId` (`adjustProductStock`) already does a revision-checked, audited single-cell numeric change or creates an inquiry row. It cannot deactivate a row.
- The Kimia/stock/price import (`_import.endpoints.ts`) has a signed, revision-checked preview/apply. Rows absent from the file are left unchanged.

## Goals

1. Board: paginated products × active warehouses. Exact warehouse cell = numeric input. Inquiry warehouse cell = «قابل استعلام» checkbox.
2. Search (name/SKU), category, brand, and status filter: all / in stock / out of stock / inquirable / not inquirable.
3. Upload box (the existing `StockImport`) stays on top, with a new opt-in «کالاهای خارج از فایل صفر شوند» for stock/Kimia modes. The preview lists those products before apply.
4. Manual numeric edits and inquiry toggles are batched as «تغییرات ذخیره‌نشده» and saved with one button.
5. Bulk: tick or untick inquiry for every row on the current page.

## Non-goals / anti-goals

- No schema migration or data rewrite. Existing balances, revisions and inquiry rows must keep their meaning.
- No change to the reservation, catalog, API or web code paths.
- No new role. Board and writes stay `manager`/`superadmin` (`manageWarehouses`).
- Anti-goal: a manual edit or toggle that bypasses revision checks or audit logging, or that zeroes stock the accountant did not see in a preview.
- No price editing on the board. Price is shown read-only; it changes only through import.

## Approaches considered

- **A. Board in front of existing endpoints, plus two small endpoints (chosen).** The numeric cells reuse `for-product`. A new bulk inquiry endpoint handles toggles, a new board read endpoint lists rows, and the import gains `zeroMissing`. Least new write logic, and every write path already has revision and audit checks.
- B. Manual edits turned into a CSV and sent through import preview/apply. This is atomic per save, but the UX is awkward: one warehouse per preview, and row numbers mean nothing.
- C. A replacement Payload list view. Riskier admin integration for no business gain. We keep `beforeListTable`, which this repo already uses.

## Decided behaviour

- Numeric cell save = one `for-product` POST per dirty cell, with the revision from the board load. Cells are independent. A stale cell reports «موجودی تغییر کرده است…» and the others still save. Inactive exact rows are read-only.
- Inquiry save = one transaction per inquiry warehouse with one audit log. Enable creates or reactivates the row and sets `lastReportedAt = now`. Disable sets `isActive = false`. No-ops are skipped. Open supply requests are unaffected because they snapshot the source.
- `zeroMissing` (default off) adds rows with `inventorySqm: 0` and `missingFromFile: true` for every row of the target exact warehouse that has `inventory_sqm > 0`, whose product SKU does not appear anywhere in the file. Invalid or duplicate file rows still count as "appearing". These rows never touch price, go through the same signed apply and revision check, and are counted in `missingCount`.
- The snapshot row cap rises from 1000 to 2000 (file ≤ 1000 + missing ≤ product count). Old tokens still parse.

## Left to the builder

Visual styling inside the existing CMS CSS-module conventions; copy beyond the strings fixed in the plan.
