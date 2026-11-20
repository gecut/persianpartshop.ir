# Maintenance Audit (enola snapshot)

Snapshot: 2026-11-20 (Asia/Tehran), `enola --generate` v0.4.38 — 8,870 facts, 152 insights from 23 explainers, taken on a working tree with uncommitted CMS catalog-settings changes.

Scope: an inventory of maintenance risks only. No remediation is proposed here. enola reads code statically and never runs it; items marked **verified** were confirmed with `git grep` against source, the rest are enola leads. `[ASSUMPTION]` marks an unverified judgment.

Known limits of this snapshot:

- enola v0.4.40 is available and its extractors changed, so this graph may be missing facts.
- 201 low-confidence orphan candidates (methods/types/consts) are only listable through enola's MCP `find_orphans` tool and were not reviewed.
- Python scripts under `.agents/skills/ui-ux-pro-max/` are counted in hotspot/fan-in results; they are tooling noise, not application code.

## 1. Dependency cycles (5)

| ID | Modules | Back-edges found in source | Notes |
| --- | --- | --- | --- |
| C1 | web (11): `account`, `account/profile-view`, `auth`, `auth/login-card`, `cart`, `checkout`, `orders`, `products`, `products/product-small-image`, `pwa`, `supply-requests` | `auth/auth-store.ts → products/selection-store`; `products/{catalog-data,use-session-value,product-qr-scanner,product-new.view,product-list/*,product-bottom-sheet/*} → auth/auth-store`; `products/product-list/product-list.view.tsx → cart/cart-store, supply-requests/*`; `products/product-new.view.tsx → checkout/cart-summary, supply-requests/*`; `supply-requests/supply-request-form.tsx → checkout/{checkout-action-footer,checkout-commit}`; `checkout/pre-invoice-modal.tsx → orders/{order-store,use-submit-order}, cart/warehouse-summary`; `cart/cart-view/_use-cart-checkout.ts → orders/use-submit-order`; `pwa/{_download-offline-data,offline-storage}.ts → account/customer-documents, products/catalog-mapper` | **verified.** AGENTS.md §5.4 accepts only the pre-existing `products`/`auth`/`cart` cycle; this one now also spans `checkout`, `orders`, `pwa`, `account`, `supply-requests`. Highest-impact item. |
| C2 | cms (7): `collections/{audit-logs,orders,products,warehouse-stock,warehouses}`, `globals`, `lib` | `audit-logs/log-action.ts`, `products/_sync-slug-and-dimensions.before-validate.ts`, `lib/tracking-number.ts` → `orders/_transaction` (`getOrderTransaction`) | **verified**; runtime imports. |
| C3 | cms (5): `src`, `collections/media`, `collections/users`, `endpoints`, `modules/catalog` | mostly `../../payload-types` (type-only) plus `../../access/roles`, `../../lib/validation` | Largely type-only `[ASSUMPTION: low runtime risk]`. |
| C4 | api (4): `src`, `src/lib`, `src/routers`, `src/rpc` | `apps/api/src/lib/otp.ts → ../payload` | **verified**; also a layer violation (§5). |
| C5 | web (2): `plans ↔ plans/plan-card` | — | Small. |

Derived effect: the longest module dependency chain is 18 (`apps/cms/src/app/(payload)` and `(payload)/admin/[[...segments]]`), driven by C2/C3.

## 2. Performance risks (38)

### I/O inside loops (likely N+1)

| Symbol | Location | Evidence |
| --- | --- | --- |
| `processSmsQueueTick` | `apps/cms/src/modules/sms/queue-worker.ts:27` | **verified**: sequential `await sendKavenegarPattern` per job; batch `limit: 10`. enola confidence 0.9. |
| `reserveWarehouseStock`, `restoreWarehouseStock` | `apps/cms/src/collections/warehouse-stock/_stock-operations.ts:41,56` | **verified**: one `db.execute` per item. |
| `applyStockImport` | `apps/cms/src/collections/warehouse-stock/_import.endpoints.ts:74` | **verified**: one `SELECT … FOR UPDATE` per row. |
| `prepareOrderBeforeValidate` | `apps/cms/src/collections/orders/_prepare-order.before-validate.ts` | `db.execute` in loop. |
| `backfill` | `apps/cms/src` | `payload.db.updateOne` in loop. |
| `StockImport` | `apps/cms/src/collections/warehouse-stock/components/stock-import.tsx` | client `fetch` in loop. |

### Nested / compounded loops

- Depth 4+ across calls: `pwa.prepareOfflinePackage` (via `applyChangedData`, `readChangedData`).
- Depth 3: `pwa.downloadOfflineData` (15 loops), `api/routers.readOfflineData` (11 loops).
- Depth 2: `api/routers.historyThumbnails`, `catalog.CatalogView`, `cms orders.sameItems`, `cms users.validateUserChanges`, `cms lib.protectReferencedDocument`, `cms catalog.mapPublicProduct`, `cms catalogCoverage`, `cms backfill`, `ui/counter.Counter` (27 loops), `cart.useCart`, `checkout.PreInvoiceModal`, `orders/activity-feed.buildReorderDraft`, `orders/order-detail.buildReorderDraft`, `plans/plan-card.usePlanProducts`, `products.createCatalogCoordinator`, `pwa.readChangedData`, `contract.offlineSnapshotImagePaths`.
- Compounded depth 2: `orders.mapDocToOrder`, `plans.usePlans`, `pwa.offlineImages`.

### Recursion with loops

`orders.protectOrderFields`, `cms lib.references`, `cms mcp.disableCapabilityDefaults`, `catalog.text`, `products.getDescriptionText`, `products.resolveMediaUrl`, `contract.hasSavedFields`.

None of these were measured; loop nesting only multiplies when each level walks an independent, growing collection.

## 3. God functions and risk concentration

### Cyclomatic complexity outliers

| Symbol | CC |
| --- | --- |
| `web products.createCatalogCoordinator` | 129 |
| `web ui/counter.Counter` | 119 |
| `web ui/code-slots.CodeSlots` | 112 |
| `cms runSeed` | 106 |
| `web supply-requests.SupplyRequestForm` | 97 |
| `cms products.syncSlugAndDimensions` | 81 |
| `web ui/slide-commit.SlideCommit` | 80 |
| `catalog product.ProductGalleryCarousel` | 72 |
| `web product-bottom-sheet.ProductGallery` | 72 |
| `web plan-card.usePlanProducts` | 70 |
| `web products.useProducts` | 69 |
| `cms activityFeedEndpoint.handler` | 68 |
| `web products.mapCatalogProduct` | 62 |
| `web pwa.downloadOfflineData` | 62 |
| `web pwa.prepareOfflinePackage` | 62 |

### Call-graph hotspots (fan-in × fan-out)

`auth.useAuth` (16×9), `auth.authStore.logout` (4×10), `pwa.updateSavedOfflineRecord` (6×8), `products.selectionStore.setQuantity` (8×5), `products.useCatalogIds` (6×6), `api routers.getUserPermissions` (4×7), `orders.mapDocToOrder` (4×7), `pwa.clearStored`, `pwa.useSavedOfflinePackage`, `pwa.publish`, `products.persist`, `selectionStore.unselectProduct`, `supply-requests.persist`, `products.formatGrade`, `pwa.refresh`, `pwa.updateOfflineEntry`.

### High fan-in

`web lib/utils.toPersianDigits` (48), `cms access.getAdminUser` (30), `cms lib.businessError` (18), `web formatToman` (16), `web auth.useAuth` (16), `toast.warning` (14), `cms orders.getOrderTransaction` (13), `authStore.getState` (13), `formatPersianDate` (12), `pwa.useNetworkReadSource` (12). Package level: `apps/cms/src/access` has the most dependents (Ca=19). `apps/web/src/modules/products` is the most imported module (118 imports); `apps/web/src/lib/utils` reaches 31 folders within three import steps.

### Large exported surfaces

`apps/cms/src` 667/761 (88%), `packages/contract/src` 231/247 (94%), `web ui/counter` 77/78, `web components/ui` 67/76, `web modules/orders` 61/61, `web ui/slide-commit` 41/41, `api src/lib` 36/40, `web modules/cart` 35/35, `web lib/utils` 35/41, `cms migrations` 29/30, `api src/rpc` 28/28, `web modules/plans` 27/29, `cms access` 21/22, `cms otps` 19/19, `cms audit-logs` 15/15, `cms modules/sms` 15/16. `packages/contract` is a deliberate public surface; the others need case-by-case review.

## 4. Dead code

### Verified unreferenced

| Symbol | Location |
| --- | --- |
| whole module (`issueOtpCommand`, `verifyOtpCommand`, `invalidateOtpCommand`, constants) | `apps/cms/src/collections/otps/_otp-service.ts` (218 lines, no importer) |
| `sendSmsNotification` (only export) | `apps/cms/src/lib/sms.ts` |
| `decodeToken` | `apps/api/src/lib/jwt.ts:86` |
| `invalidateOtp` | `apps/api/src/lib/otp.ts:187` |
| `isCatalogEditor` | `apps/cms/src/access/roles.ts:48` |
| `parseStockCsv` (superseded by `parseImportCsv` in `_import-csv.ts` `[ASSUMPTION]`) | `apps/cms/src/collections/warehouse-stock/_import.endpoints.ts:15` |
| `formatPlanRemainingTime` | `apps/web/src/lib/utils/date.ts:114` |
| `retryWithoutImageCors` (module itself is used) | `apps/web/src/modules/products/_product-image-cors.ts:10` |
| `payloadAuth` re-export with no consumer | `apps/api/src/payload.ts:4` |
| temporary fixture config, flagged for removal in `.agents/brain/product-qr-implementation-2026-11-07.md` | `apps/web/.qr-fixture.vite.config.ts` |

### Test-only

`canUpdateOperationalInventory` (`apps/cms/src/collections/products/_product-access.ts:28`), `sendAfterCommit` (`apps/cms/src/lib/committed-sms.ts:85`).

### enola false positives

`generateStaticParams` (`apps/catalog/src/app/[[...entry]]/page.tsx`, `p/[identifier]/page.tsx`) and `NextConfig` (`apps/cms/next.config.ts`) are Next.js conventions.

## 5. Other maintenance findings

- **Layer violations**: `apps/api/src/lib/otp.ts → apps/api/src/payload`; `apps/web/src/lib/drafts.ts → @/components/feedback/toast` (also conflicts with AGENTS.md §5.4: `lib/` must stay infra-only).
- **Duplicate route**: `GET /health` in `apps/api/src/server.ts:65` and `apps/catalog/src/app/health/route.ts`; separate services, so likely a false positive `[ASSUMPTION]`.
- **Duplicated helpers inside one app**: digit normalization in `apps/api` (`normalizeDigits`) and `apps/cms/src/modules/sms/kavenegar-client.ts`; `buildReorderDraft` in both `orders/activity-feed` and `orders/order-detail`; two stock CSV parsers. Catalog ↔ Web formatting duplication is intentional (see [12 — Public Catalog](12-public-catalog.md)) and is not a finding.
- **Outbound HTTP not visible from this repo's routes**: `apps/cms/src/globals/components` (4 endpoints), `apps/api/src/routers` (3: `/activity-feed`, `/catalog-browse`, `/plan-browse`), `apps/cms/src/collections/warehouse-stock/components` (2).

## 6. Disposition (2026-11-20)

Re-checked against source before acting. A Tarjan SCC pass over each app's resolved import graph found **no runtime file-level import cycle** in web, cms or api. C1–C5 are folder/module coupling, not load-order hazards.

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Duplicate `buildReorderDraft` | **Fixed (behaviour bug).** The feed copy dropped `productType`/`unit` for items missing from the catalog. Both views now share `orders/build-reorder-draft.ts`. | `63ec2d4`, unit test |
| C1 web | **Fixed for non-view code.** Media helpers and document types moved to `lib/`; `auth` exposes `onSessionEnd`; catalog core split into `modules/catalog`. Edges toward features remain only from `*.view.tsx` composition roots (e.g. `orders/*.view → checkout`). | `2bc126d`, `4b208d2`, `742bf2a` |
| C2 cms | **Fixed.** `getOrderTransaction` → `lib/transaction.ts` `getTransactionDb`. | `8c1195d` |
| C3 cms | **Accepted.** Type-only through `payload-types`. | — |
| C4 api | **Fixed.** Adapter moved to `src/lib/payload.ts`; unused `payloadAuth` removed. | `8482b43` |
| C5 plans | **Accepted.** `plans.view → plan-card` plus type-only `plan-types` imports. | — |
| `processSmsQueueTick` | **Fixed.** Atomic `FOR UPDATE SKIP LOCKED` claim (`sending`, `claimedAt`, 2-minute stale reclaim, at-least-once), concurrency 3. A failed status write no longer schedules a provider retry. | `03a0978`, unit tests. Migration **not yet run against a database.** |
| Stock reserve/restore/import, `prepareOrderBeforeValidate` | **Accepted by design.** Per-row statements keep a deterministic lock order (deadlock avoidance) and per-item error detection; bounded by cart/CSV size. | — |
| `backfill`, `StockImport` fetch loop | **False positive.** One-off script; paginated warehouse list. | — |
| Nested-loop leads | **Needs profiling.** Not measured; no change without a measurement. | — |
| `createCatalogCoordinator` | **Reduced.** Pure snapshot transforms extracted to `_catalog-snapshot.ts` with tests. | `348fba3` |
| `SupplyRequestForm` | **Reduced.** State moved to `supply-request-form/_use-supply-request-form.ts`. | `d1c376c` |
| `Counter`, `CodeSlots`, `SlideCommit`, `runSeed`, `syncSlugAndDimensions`, offline download functions | **Accepted.** Self-contained UI primitives, dev seed, tested hook; offline functions left until covered by tests. | — |
| Verified dead code | **Removed**, plus `canUpdateOperationalInventory` (inventory fields hard-deny writes). | `1fa4473`, `6dc5166`, `e11ba04` |
| `sendAfterCommit` | **Kept, open.** Unused, but it shares `lib/committed-sms.ts` with the live PostgreSQL commit-failure patch; removing the notification path would also drop that file's only test. | — |
| Layer violations | **Fixed.** `lib/drafts.ts` uses `setDraftFailureReporter`; api lib no longer imports root. | `9d5b857`, `8482b43` |
| `normalizeDigits` api/cms, `/health`, outbound HTTP | **Accepted / false positive.** Separate services; no shared runtime package. | — |
| Regression guard | **Added.** `pnpm check:deps` (dependency-cruiser) rejects runtime cycles, layer and private-file violations. | `871863d` |

## Reproduce

```bash
enola --generate .
enola --explain . --summary
```

Insights are written to `.enola/insights.json`.
