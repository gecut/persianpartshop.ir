# Product Families ("طرح") Implementation Plan

> **For agentic workers:** Execute task-by-task in order. Steps use checkbox (`- [ ]`) syntax. Each task leaves every workspace compiling. Do NOT commit, push, deploy, or run migrations against any shared/production database — the user commits explicitly (AGENTS.md §7).

**Goal:** Let an admin manually group independent products into a "طرح" (design family) and show the other members of the same family in the Web product modal and on the public Catalog product page.

**Architecture:** A new Payload collection `product-families` with a single optional relationship `products.family` (Join field for the reverse view). Web derives members locally from the already-synced, ACL-scoped catalog snapshot (`byId`) — no new API procedure. The public Catalog's `product` operation always returns `familyOptions`, computed in CMS through the existing publication policy.

**Tech Stack:** Payload CMS v3.90 + PostgreSQL, oRPC contract + Zod (`packages/contract`), Hono/Bun API, React 19 + HeroUI v3 + Tailwind v4 (Web), Next.js App Router (Catalog).

**Spec:** `.agents/brain/product-families-design.md` (Persian). Where it says "unchanged from the previous plan" it refers to `.agents/brain/product-families-implementation-plan.md`; that older file is otherwise superseded.

## Global Constraints

- pnpm only; no new dependencies or services.
- No `any`; derive types from schemas/contracts; kebab-case files; named exports; no barrel files except the existing collection `index.ts` pattern.
- `apps/web` module layers (AGENTS.md §5.4): `products` may import `catalog`; `_`-prefixed files are module-private. `pnpm check:deps` must pass.
- RTL: logical utilities only (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`); SKU inside `<bdi>`; numbers through existing helpers (`apps/web/src/lib/utils/currency.ts`, `apps/catalog/src/lib/format.ts`).
- Admin labels (verbatim): singular `طرح`, plural `طرح‌ها`, group `محصولات و کاتالوگ`; product field label `طرح`; field description `طرحی که این کالا یکی از نسخه‌های آن است. تغییر این فیلد فقط همین کالا را جابه‌جا می‌کند.`
- Section title in both UIs (verbatim): `گزینه‌های دیگر این محصول`; current-member badge: `در حال مشاهده`.
- Member sort everywhere: name (`localeCompare(…, 'fa')`), then width asc, then height asc (null last), then grade index in `PRODUCT_GRADE_OPTIONS` (unknown last), then numeric id.
- Section hidden when fewer than 2 visible members.
- Choosing an option only views that product; it never touches cart, selection, quantities, warehouse, or supply drafts.
- No MCP registration, no auto-grouping, no data backfill, no family name exposed to Web or the public Catalog.
- Family read limit in CMS public query: 100; `total > 100` → throw, never truncate.

## Review Focus

1. **Populated relation leaking to the browser** — `depth: 1` in API `sdk.find` may populate `family` into an object; the Web record must carry only `familyId: number | null`. Test in Task 2.
2. **SQL precedence** — appending `AND p.family_id = …` after an unparenthesized `a OR b` policy condition would let additions from other families through. Test in Task 4 (condition must be wrapped).
3. **Legacy cached/offline records without `familyId`** — must parse and render no section, and `undefined`/`null` must never match each other as one family. Test in Task 3.
4. **Fast option switching (A→B→A)** — gallery/QR/zoom must reset per id; selection state stays derived from the active product. Covered by `key` on the gallery and existing `qrOpen` reset; manual check in Task 3.
5. **Hidden price/stock in public options** — options must go through `mapPublicProduct`; no raw row fields. Test in Task 4.

---

### Task 1: CMS — `product-families` collection, relation, delete guard, audit, migration

**Files:**
- Create: `apps/cms/src/collections/product-families/product-families.collection.ts`, `apps/cms/src/collections/product-families/index.ts`
- Create: `apps/cms/src/collections/products/_family-change.ts`, `apps/cms/src/collections/products/_family-change.test.ts`
- Create: `apps/cms/src/migrations/20261121_120000_product_families.ts`
- Modify: `apps/cms/src/collections/products/products.collection.ts` (field in the specs tab next to `grade`, lines ~127–145; afterChange log ~45–70)
- Modify: `apps/cms/src/payload.config.ts:136-157` (register `ProductFamilies` after `Products`)
- Modify: `apps/cms/src/lib/protect-relations.ts:18-32` (`referenceActions`)
- Modify: `apps/cms/src/migrations/index.ts` (append entry)
- Modify: `apps/cms/package.json` `test:unit` (append `src/collections/products/_family-change.test.ts`)
- Generated: `apps/cms/src/payload-types.ts`, import map

**Interfaces:**
- Produces: collection slug `product-families`; `Product['family']: number | ProductFamily | null | undefined` in generated types; DB column `products.family_id`.
- Produces: `familyChange(previous: unknown, next: unknown): string | null` — normalizes number/`{ id }`/null/undefined to `number | null`; returns `null` when equal, else `طرح: <prev ?? '-'> -> <next ?? '-'>` with ids in `fa-IR` digits.

- [ ] **Step 1: Write the failing test** `_family-change.test.ts` (node:test + `assert`, same style as `_inventory-math.test.ts`):
  - `familyChange(3, { id: 3 }) === null`
  - `familyChange(null, undefined) === null`
  - `familyChange(null, 5) === 'طرح: - -> ۵'`
  - `familyChange({ id: 2 }, null) === 'طرح: ۲ -> -'`
- [ ] **Step 2:** Run `pnpm --filter @persianpart/cms test:unit` → FAIL (module missing).
- [ ] **Step 3: Implement** `familyChange`, then push its result into `changes` in the products `afterChange` hook when non-null.
- [ ] **Step 4: Collection** `ProductFamilies`: slug `product-families`, labels per Global Constraints, `admin: { useAsTitle: 'name', group: 'محصولات و کاتالوگ', defaultColumns: ['name', 'updatedAt'] }`, access `read: isAdminAuthenticated`, create/update/delete `isCatalogManager` (from `../../access/roles`). Fields:
  - `name`: text, required, `maxLength: 160`, label `نام طرح`, description `مثلاً «آلاوس — پرسپولیس یزد».`, `validate` rejects whitespace-only with `نام طرح الزامی است.`; a `beforeValidate` field hook trims.
  - `products`: `type: 'join'`, `collection: 'products'`, `on: 'family'`, label `کالاهای این طرح`, `admin.defaultColumns: ['name', 'sku', 'grade', 'dimension', 'color', 'isActive']`. Check the installed Payload join field types for the exact `admin` key before using it.
- [ ] **Step 5: Product field** in the specs tab: `{ name: 'family', type: 'relationship', relationTo: 'product-families', hasMany: false, index: true, maxDepth: 0, label: 'طرح', admin: { description: <verbatim> } }`. No `unique`, no `filterOptions`.
- [ ] **Step 6:** Register in `payload.config.ts` inside the same `protectBusinessRelations([...])` list. Add `'products.family': 'ابتدا طرح را از فرم کالاهای عضو بردارید یا تغییر دهید.'` to `referenceActions`. `restrictBusinessForeignKeys` already forces `ON DELETE restrict` for non-`payload_` tables; do not change it.
- [ ] **Step 7: Migration**, hand-written SQL in the style of `20261111_070000_sms_queue_locked_documents_rel.ts`, with names copied from the baseline conventions (`tags` table, `products_dimension_idx`). Do not use `migrate:create`: it diffs against the baseline snapshot.
  - **up:**
    - `CREATE TABLE IF NOT EXISTS "product_families" ("id" serial PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL)`
    - indexes `product_families_updated_at_idx` and `product_families_created_at_idx`
    - `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "family_id" integer`
    - `CREATE INDEX IF NOT EXISTS "products_family_idx" ON "products" USING btree ("family_id")`
    - FK `products_family_id_product_families_id_fk` → `product_families(id)` `ON DELETE restrict ON UPDATE no action`, wrapped in `DO $$ … duplicate_object …`
    - `payload_locked_documents_rels."product_families_id" integer` + index `payload_locked_documents_rels_product_families_id_idx` + FK `payload_locked_documents_rels_product_families_fk` `ON DELETE cascade`
  - **down:** reverse order, all `IF EXISTS`.
  - No `UPDATE` statements.
  - Append `{ up, down, name: '20261121_120000_product_families' }` to `index.ts`.
- [ ] **Step 8:** Run `pnpm --filter @persianpart/cms generate:types` then `pnpm --filter @persianpart/cms generate:importmap`. Do not hand-edit the generated output.
- [ ] **Step 9: Verify**
  - `pnpm --filter @persianpart/cms exec tsc --noEmit` → exit 0
  - `pnpm --filter @persianpart/cms test:unit` → all pass
- [ ] **Step 10: Local migration rehearsal.** Only after confirming `DATABASE_URL` points to a local, disposable DB; never print `.env`. Skip and mark `[UNKNOWN]` if no such DB exists.
  - Before: record `SELECT count(*), md5(string_agg(id||sku||name||coalesce(grade,''), ',' ORDER BY id)) FROM products`.
  - Run `pnpm --filter @persianpart/cms migrate`.
  - After: the same digest matches; `SELECT count(*) FROM products WHERE family_id IS NOT NULL` = 0; `\d products` shows the index and the FK with restrict.
- [ ] **Step 11: Manual admin check** (local dev):
  - Create طرح F; set it on A and B; open F and see A and B in the join list.
  - Move A to G; F lists only B.
  - Delete F fails with the referenceActions message; delete an empty طرح succeeds.
  - Products list → select 2 rows → Edit many → field `طرح` → set. Record whether Edit many offers the field and inline create.

### Task 2: Contract + API — `familyId` on `CatalogRecord`

**Files:**
- Modify: `packages/contract/src/catalog.ts:431-435` (`CatalogRecordSchema`)
- Modify: `apps/api/src/routers/catalog-sync.ts:20-33` (`productProjection`, `catalogRecord`)
- Create: `apps/api/src/routers/catalog-record.test.ts`

**Interfaces:**
- Consumes: `Product['family']` from Task 1.
- Produces: `CatalogRecord['familyId']: number | null | undefined` (schema `z.number().int().positive().nullable().optional()`); server output is always `number | null`.

- [ ] **Step 1: Write the failing test** `catalog-record.test.ts` (bun:test). Build a minimal `Product` fixture and a scope with default permissions, and call `catalogRecord` for three cases:
  - `family: 7` → `familyId === 7`
  - `family: { id: 7, name: 'x', … }` → `familyId === 7` and the result has no `family` key
  - `family: null` → `familyId === null`

  If importing `catalogRecord` drags in `sdk` env side effects, extract `familyIdOf(value: Product['family']): number | null` into `apps/api/src/routers/catalog.helpers.ts` and test that plus a `CatalogRecordSchema.parse` round-trip instead.
- [ ] **Step 2:** Run `pnpm --filter @persianpart/api test` → FAIL.
- [ ] **Step 3: Implement.** Add `family: true` to `productProjection`. In `catalogRecord`, destructure `family` out of `safe` and spread `familyId: familyIdOf(product.family)`. The raw `family` must never reach `CatalogRecordSchema.parse`; the schema is non-strict, so it would pass silently.
- [ ] **Step 4: Verify**
  - `pnpm --filter @persianpart/api typecheck && pnpm --filter @persianpart/api test` → pass
  - `pnpm --filter @persianpart/web exec tsc --noEmit` → pass (legacy records without the field still typecheck)

### Task 3: Web — local family members and modal section

**Files:**
- Create: `apps/web/src/modules/catalog/catalog-family.ts`, `apps/web/src/modules/catalog/catalog-family.test.ts`
- Create: `apps/web/src/modules/products/product-bottom-sheet/_use-family-options.ts`
- Create: `apps/web/src/modules/products/product-bottom-sheet/_product-family-options.tsx`
- Modify: `apps/web/src/modules/products/product-bottom-sheet/product-bottom-sheet.tsx` (props at line 12; insert after `<ProductSpecGrid>` at line 163)
- Modify: `apps/web/src/modules/products/product-list/product-list.view.tsx:304-331`
- Modify: `apps/web/src/modules/plans/plan-card/plan-card.tsx:110-116`
- Create: `apps/api/src/routers/offline-data.test.ts` (proves `structuralOfflineData` keeps `familyId`; `offline-data.ts` itself needs no change because it spreads the remaining fields)

**Interfaces:**
- Consumes: `CatalogRecord['familyId']` (Task 2); `useCatalogData()` → `{ state: { byId, complete } }`; `mapCatalogProduct`; `catalogCoordinator.resume()`.
- Produces:
  - `familyMembers(byId: Record<string, CatalogRecord>, familyId: number | null | undefined): CatalogRecord[]` (sorted per Global Constraints; `[]` when `familyId == null`)
  - `useFamilyOptions(productId: string | undefined, isOpen: boolean): Product[]`
  - `ProductFamilyOptions({ options, activeId, onViewProduct }: { options: Product[]; activeId: string; onViewProduct: (product: Product) => void })`
  - New `ProductBottomSheetProps.onViewProduct?: (product: Product) => void`

- [ ] **Step 1: Write the failing tests** `catalog-family.test.ts` (bun:test):
  - `familyMembers(byId, null)` and `familyMembers(byId, undefined)` → `[]`, even when other records have `familyId` null/undefined.
  - Records in family 1: id 1 `{ name: 'ب', width: 120, height: 280, grade: 'grade_d' }`, id 2 `{ name: 'ب', width: 120, height: 120, grade: 'grade_1' }`, id 3 `{ name: 'الف', width: 120, height: 280, grade: 'grade_1' }`. Family 2: id 4. Legacy id 5 with no `familyId` → `familyMembers(byId, 1).map(r => r.id)` deep-equals `[3, 2, 1]`.
  - Same name and size: `grade_1` sorts before `grade_d`; unknown grade sorts last.
  - Width read from `dimension.width` when present, else `record.width`; null widths last.
- [ ] **Step 2:** Run `pnpm --filter @persianpart/web test:unit` → FAIL.
- [ ] **Step 3: Implement** `familyMembers` as a pure function. Iterate `Object.values(byId)`; no mutation of input.
- [ ] **Step 4: Implement** `useFamilyOptions`:
  - read `state.byId` from `useCatalogData()`
  - `familyId = productId ? state.byId[productId]?.familyId : undefined`
  - `useMemo` → `familyMembers(...).map(mapCatalogProduct)`
  - one `useEffect` keyed on `[isOpen, productId]` calls `void catalogCoordinator.resume()` when `isOpen`
  - no new query, query key, or state.
- [ ] **Step 5: Implement** `ProductFamilyOptions`:
  - Return `null` when `options.length < 2`.
  - Section with heading `گزینه‌های دیگر این محصول`, compact rows, no images.
  - Each row shows: full name (wrapping), `grade`, `dimension`, SKU in `<bdi>`, price via the same formatter `ProductPriceStrip` uses, and stock status reusing `_product-stock-value.tsx` rules (respect `hideExactStock`).
  - Non-current rows: a HeroUI `Button` with `onPress={() => onViewProduct(option)}` and `aria-label` `مشاهدهٔ ${option.name}`.
  - Current row: the badge `در حال مشاهده`, `aria-current="true"`, no button.
  - Out-of-stock rows stay clickable.
  - Check the heroui-react MCP for Button props before use.
- [ ] **Step 6: Wire the modal.**
  - In `ProductBottomSheet`, call `useFamilyOptions(activeProduct?.id, isOpen)`.
  - Render `<ProductFamilyOptions>` right after `<ProductSpecGrid>` only when `onViewProduct` is provided.
  - When `product?.id` changes, also clear `zoomSession`/`zoomSelection`; `qrOpen` already resets.
  - `ProductListView`: `onViewProduct={product => setActiveProductId(product.id)}`. Selection and supply props keep deriving from `activeBottomSheetProduct`.
  - `PlanCard`: `onViewProduct={setSelectedProductForDetail}`; `isSelected={false}` and `isOrderingDisabled` stay as they are.
- [ ] **Step 7: Offline structural test.** In `apps/api`, add a bun test: two `OfflineSnapshot`s identical except one product's `familyId` → `JSON.stringify(structuralOfflineData(a)) !== JSON.stringify(structuralOfflineData(b))`.
- [ ] **Step 8: Verify**
  - `pnpm --filter @persianpart/web exec tsc --noEmit && pnpm --filter @persianpart/web test:unit && pnpm --filter @persianpart/web build && pnpm --filter @persianpart/api test && pnpm check:deps` → all pass
- [ ] **Step 9: Manual browser check** (local stack, fixtures from Task 1):
  - A↔B switching; rapid A→B→A: name, price, gallery, QR and actions all belong to the active product.
  - Select A, view B: A stays selected; toggling on B affects B only.
  - From PlanCard, switching works and ordering stays disabled.
  - Search that finds only A: B is still listed.
  - Offline with a saved package: section built from package data; zero network requests for families.
  - 375px width: no horizontal overflow; keyboard focus reaches the option buttons.

### Task 4: Contract + CMS — public `familyOptions`

**Files:**
- Modify: `packages/contract/src/public-catalog.ts` (new schema after `PublicCatalogProductSchema` ~line 286; `catalogOperations.product.output` ~line 334)
- Modify: `packages/contract/src/public-catalog.test.ts`
- Modify: `apps/cms/src/modules/catalog/catalog-query-types.ts:33-40`
- Modify: `apps/cms/src/modules/catalog/catalog-query-sql.ts:80-82,122`
- Create: `apps/cms/src/modules/catalog/catalog-query-sql.test.ts` (register in CMS `test:unit`)
- Modify: `apps/cms/src/modules/catalog/catalog-service.ts:27-40` (projection) and `185-203` (`product`)
- Modify: `apps/cms/src/modules/catalog/catalog-mapper.ts` + `catalog-mapper.test.ts`

**Interfaces:**
- Produces:
  - `PublicCatalogFamilyOptionSchema = PublicCatalogProductSchema.pick({ id, name, sku, productType, brand, dimension, color, grade, tags, width, height, unit, weight, itemsPerPack, price, stock }).strict()`
  - `type PublicCatalogFamilyOption`
  - `product.output` gains a required `familyOptions: z.array(PublicCatalogFamilyOptionSchema)`
- Produces: `CatalogQuery.familyId?: number` (internal only).
- Produces: `toFamilyOption(product: PublicCatalogProduct): PublicCatalogFamilyOption` in `catalog-mapper.ts`.

- [ ] **Step 1: Write the failing tests**
  - Contract test: `catalogOperations.product.output.parse({ config, product, familyOptions: [] })` succeeds; omitting `familyOptions` fails; an option with an extra key (`familyId`) fails.
  - Mapper test: given a mapped product with `price: { mode: 'hidden' }` and `stock: { mode: 'hidden' }`, `toFamilyOption` keeps exactly those modes and has none of `description`, `photos`, `cover`, `updatedAt`, `sqmPerCarton`.
  - SQL test: `catalogQuerySQL({ policy, mode: 'browse', familyId: 9, limit: 100 })`, where `policy.condition` is an `or` of two predicates. Assert `params` contains `9`, the text never contains the literal `9` outside a `$n` placeholder, and the matching `WHERE` wraps the condition, i.e. `text` contains `WHERE (`.
- [ ] **Step 2:** Run `pnpm --filter @persianpart/cms test:unit` → FAIL.
- [ ] **Step 3: Implement the query.**
  - Add `familyId?: number` to `CatalogQuery`.
  - In `catalogQuerySQL`, change the matching clause to `WHERE (${condition})${target}`, and append ` AND p.family_id = ${param(input.familyId)}::bigint` to `target` when `familyId != null`.
- [ ] **Step 4: Implement the service.**
  - Add `family: true` to the CMS service `projection`.
  - In `product`, after resolving `products[0]`: read the origin's family id. Use the hydrated doc's `family`, normalized to an id; prefer extending `hydrate` to return it alongside, or a `req.payload.findByID({ collection: 'products', id, depth: 0, select: { family: true }, req, overrideAccess: false })`.
  - No family → `familyOptions: []`.
  - Otherwise run `query({ policy: compilePolicy(settings), mode: 'browse', familyId, limit: 100, page: 1, sort: 'default' })`. If `total > 100`, `throw unavailable()`. Otherwise `familyOptions = (await hydrate(rows, settings)).map(toFamilyOption)`.
  - Errors propagate; never convert them to `[]`.
- [ ] **Step 5: Verify**
  - `pnpm --filter @persianpart/cms exec tsc --noEmit && pnpm --filter @persianpart/cms test:unit` → pass
- [ ] **Step 6: Real PostgreSQL check** (local DB with Task 1 fixtures). Mark `[UNKNOWN]` if unavailable.
  - POST the local catalog `product` operation for A: `familyOptions` holds only published F members.
  - Exclude B in catalog settings → B disappears.
  - Add D (family G) via additions → D is not in F's options.
  - Paused catalog or excluded origin → 404 `CATALOG_NOT_FOUND`.

### Task 5: Catalog app — family options section

**Files:**
- Create: `apps/catalog/src/modules/product/_family-options-order.ts`, `apps/catalog/src/modules/product/_family-options-order.test.ts`
- Create: `apps/catalog/src/modules/product/_product-family-options.tsx`
- Modify: `apps/catalog/src/modules/product/product.view.tsx` (insert after `<ProductSpecGrid product={product} />`)

**Interfaces:**
- Consumes: `CatalogOutput<'product'>['familyOptions']` (Task 4).
- Produces:
  - `sortFamilyOptions(options: PublicCatalogFamilyOption[]): PublicCatalogFamilyOption[]` (Global Constraints order; numeric id compare)
  - `ProductFamilyOptions({ options, currentId }: { options: PublicCatalogFamilyOption[]; currentId: string })`

- [ ] **Step 1: Write the failing test** `_family-options-order.test.ts` (node:test). Use the same ordering cases as Task 3 Step 1, adapted to the public shape (`width`/`height` top-level, `grade` raw value). Also: id `'10'` sorts after `'9'` on a full tie.
- [ ] **Step 2:** Run `pnpm --filter @persianpart/catalog test` → FAIL.
- [ ] **Step 3: Implement** `sortFamilyOptions`.
- [ ] **Step 4: Implement** `ProductFamilyOptions`:
  - Return `null` when `options.length < 2`.
  - Same heading and badge copy as Web.
  - Rows show name, `formatGrade(grade)`, `dimension?.name`, SKU in `<bdi>`.
  - Price:
    - `amount` → `formatToman` + `TomanIcon`
    - `unpriced` → `قیمت اعلام نشده`
    - `hidden` → nothing at all
  - Stock: reuse the rendering rules already in `_product-specifications.tsx`, and render nothing when `stock.mode === 'hidden'`.
  - Non-current rows are `next/link` `<Link href={`/p/${id}`} prefetch={false}>`.
  - The current row has `aria-current="page"` and is not a link.
  - Nothing is imported from `apps/web`.
- [ ] **Step 5: Wire.** Destructure `familyOptions = []` in `ProductView` and render `<ProductFamilyOptions options={sortFamilyOptions(familyOptions)} currentId={product.id} />` after the spec grid. Leave `catalog-server.ts` (ISR 300) and the share metadata untouched.
- [ ] **Step 6: Verify**
  - `pnpm --filter @persianpart/catalog typecheck && pnpm --filter @persianpart/catalog test && pnpm --filter @persianpart/catalog build` → pass
- [ ] **Step 7: Manual browser check.**
  - Links change URL and title.
  - With price mode hidden, no price or toman icon appears in options DOM or `aria-label`s.
  - With stock mode hidden, no stock badge.
  - The page HTML still has `noindex`, and metadata has no price/stock.
  - 375px: no horizontal overflow.

### Task 6: Docs, final checks, execution report

**Files:**
- Modify: `docs/11-product-creation-standards.md` (short section: طرح is optional, manual, single-valued; naming rules unchanged; bulk grouping via Edit many)
- Modify: `docs/12-public-catalog.md` (family options follow the per-member policy; always present in `product`; ISR freshness applies)
- Create: `.agents/brain/product-families-execution-report.md`

- [ ] **Step 1:** Write both doc sections (Persian, matching each file's tone).
- [ ] **Step 2: Final gate**
  - `pnpm check:deps && pnpm check-types && pnpm test:unit` → all pass
  - Do not re-run builds that already passed in Tasks 3 and 5 unless files changed since.
- [ ] **Step 3: Report.** Include:
  - base commit, changed files, and each command with its real result
  - migration rehearsal evidence and manual UI/admin observations, including the Edit many result
  - everything not verified, marked `[UNKNOWN]`

  A passing typecheck is not a DB, ACL, admin, or browser verification.
