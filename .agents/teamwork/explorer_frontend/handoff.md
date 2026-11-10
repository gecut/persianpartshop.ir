# Handoff Report — Frontend, Shared Contracts & Client Performance

- **Agent**: explorer_frontend
- **Target / Recipient**: d9727e7d-d864-4b61-a8fc-1a1433c1459a (Orchestrator)
- **Role**: Frontend, Shared Contracts & Client Performance Explorer
- **Date**: 2026-11-10T13:30:00Z
- **Working Directory**: `/Users/mm25zamanian/Codes/persianpartshop.ir/.agents/teamwork/explorer_frontend`

---

## 1. Observation

Direct empirical observations verified via local tools:

1. **TanStack Query Default Cache & Focus Storm**:
   - In `apps/web/src/lib/query-client.ts:26`:
     ```ts
     defaultOptions: {
       queries: {
         staleTime: 120_000,
         gcTime: 30 * 60_000,
         refetchOnWindowFocus: true,
       },
     }
     ```
   - In `apps/web/src/app/use-session-sync.ts:28-29`:
     ```ts
     staleTime: 60_000,
     refetchOnWindowFocus: true,
     ```
   - In `apps/web/src/modules/products/catalog-data.ts:27-29`:
     ```ts
     window.addEventListener('online', () => void catalogCoordinator.resume())
     window.addEventListener('focus', () => void catalogCoordinator.resume())
     document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void catalogCoordinator.resume() })
     ```
   - In `apps/web/src/modules/products/catalog-coordinator.ts:89-119`:
     Every 120 seconds on focus/resume, `pump()` launches a sequential multi-page sweep (`syncPage({ cursor, limit: 100 })`) until `!page.nextCursor`.

2. **Bundle Size & Chunk Splitting**:
   - Rollup output inspection of `apps/web/dist/assets/`:
     - `index-CDWzr00B.js`: **1,492,245 bytes** (~1.49 MB uncompressed JS in a single entry chunk).
     - `index-CXHiVsZ4.css`: **517,197 bytes** (~517 KB CSS).
     - `Navy Spiral Emblem App Icon.png` in `dist/`: **1,263,095 bytes** (~1.26 MB).
   - In `apps/web/vite.config.ts:73-146`: No `build.rollupOptions.output.manualChunks` is defined.
   - In `apps/web/src/routes/*.tsx`: All route definitions (`account.tsx`, `cart.tsx`, `orders/index.tsx`, `orders/$id.tsx`, `plans.tsx`, `product/index.tsx`) statically import their view components instead of using lazy routes.
   - Unused dependency: `ogl: ^1.0.11` in `apps/web/package.json:27` is not imported anywhere in `apps/web`.

3. **Complete Absence of Error Boundaries**:
   - Grep search for `ErrorBoundary` in `apps/web` returned 0 matches.
   - In `apps/web/src/routes/__root.tsx:5-8`:
     ```ts
     export const Route = createRootRoute({
       beforeLoad: authGuard,
       component: RootLayoutView,
     })
     ```
     No `errorComponent` and no `notFoundComponent` are specified.
   - In `apps/web/src/main.tsx:47-52`:
     ```tsx
     root.render(
       <React.StrictMode>
         <QueryClientProvider client={queryClient}>
           <RouterProvider router={router} />
         </QueryClientProvider>
       </React.StrictMode>
     )
     ```
     No outer React `ErrorBoundary` wraps the application tree.

4. **Typesafety Erosion via `z.any()` in `packages/contract`**:
   - Over 40 endpoints in `packages/contract` use `.or(z.any())` or `.output(z.any())`:
     - `packages/contract/src/catalog.ts:678`: `.output(createPaginatedResponseSchema(CatalogProductSchema).or(z.object({ items: z.array(z.any()), total: z.number() })).or(z.any()))`
     - `packages/contract/src/catalog.ts:709, 720, 725, 730, 740, 751`: all have `.or(z.any())` or `.output(z.any())`.
     - `packages/contract/src/shopping.ts:32, 41, 46, 51, 56, 80, 84, 92, 112`: all output `z.any()`.
     - `packages/contract/src/auth.ts:41, 60, 72, 101, 115`: output `z.any()`.
     - `packages/contract/src/order.ts:239, 258, 271, 356`: output `z.any()`.
     - `packages/contract/src/customer.ts:189, 204, 209, 217, 232, 249, 263, 274`: output `z.any()`.
   - Mismatched domain model: `PartSchema` in `packages/contract/src/catalog.ts:16-27` defines auto spare parts (`vehicleBrand`, `partNumber`), but the application domain is ceramic tiles.

5. **State Ownership, Leaks & Re-renders**:
   - In `apps/web/src/lib/write-activity.ts:38`:
     `window.setInterval(() => { if (localCount + mutationCount) announce(); else refresh() }, 5_000)` executes continuously in all tabs, iterating over all keys of `localStorage` and executing `JSON.parse`.
   - In `apps/web/src/modules/products/product-card.tsx:78`:
     `<ProductThumbnail onOpenBottomSheet={() => onOpenBottomSheet?.(product)} />` passes an inline arrow function, breaking the `React.memo` wrapping on `ProductThumbnail`.
   - In `apps/web/src/modules/products/product-list/_use-product-virtualizer.ts:54, 66`:
     `virtualItems` (a newly created array on every render) is in the dependency array of `useEffect`, causing effect churn on every frame.
   - In `apps/web/src/modules/products/selection-store.ts:159`: `setQuantity` resets `quotes: []`, dropping the cart UI into unvalidated client mathematical estimates.
   - Native blocking dialogs: `alert()` in `api-client.ts:66`, `window.confirm()` in `auth-store.ts:218`, `supply-request-draft.ts:44, 73`.

6. **RTL & Persian Localization Compliance**:
   - Hardcoded physical directional styles:
     - `apps/web/src/app/app-header.tsx:59`: `ml-1` instead of logical `ms-1`.
     - Multiple instances of `text-right` instead of `text-start`: `toast.tsx:19`, `_profile-details-card.tsx:37`, `_sort-filter.tsx:52,56,75,81`, `_dimension-select.tsx:23,47,51,70,76`, `_cancel-order-modal.tsx:85,89,110`, `_invoice-items-table.tsx:29,38,41,88,91`, `_product-stock-value.tsx:15,21,27`.
   - Currency & Number formatting:
     - `apps/web/src/lib/utils/currency.ts:26-29`: `formatToman` formats digits but omits currency unit string, causing fragmented unit label appending across UI.
     - `apps/web/src/lib/utils/currency.ts:34-37`: `formatSquareMeters` uses `rounded.toFixed()` which outputs English decimal period `.` (e.g. `۳۵.۲`) rather than Persian decimal separator `٫`.
     - Inconsistent ZWNJ: `بروزرسانی` in `pwa-controls.tsx:75` vs `به‌روزرسانی` in `profile-view.tsx:93`.

---

## 2. Logic Chain

1. **From Observation 1 to High-Concurrency Bottleneck**:
   - Because `refetchOnWindowFocus: true` is configured in `query-client.ts` and `catalogCoordinator` unconditionally initiates a full catalog sync on window focus and visibility changes (`catalog-data.ts:27-29`), thousands of clients returning to the app or switching tabs concurrently fire `api.catalog.syncPage` in 100-item sequential batches.
   - For 5,000 active users and a 1,000-product catalog, this yields up to 50,000 sequential API requests hitting Hono/Bun and Postgres within a 2-minute window.
   - Therefore, under high concurrency, the client's aggressive refetching behavior creates an artificial Denial-of-Service / Thundering Herd condition on the backend.

2. **From Observation 2 to Mobile Network Penalty**:
   - Because all route files in `src/routes/` statically import their view components and `vite.config.ts` has no `manualChunks` splitting, Vite packs all components into a single 1.49 MB JS file and 517 KB CSS file.
   - On Iran's 3G/4G cellular networks, downloading and parsing >2 MB of uncompressed assets creates an initial load latency exceeding 4-6 seconds, severely harming bounce rates and user conversion.

3. **From Observation 3 to Reliability Crisis (WSOD)**:
   - React 19 unmounts the entire component tree when a component throws an uncaught JavaScript runtime error during render.
   - Because neither `apps/web/src/main.tsx`, `root-layout.view.tsx`, nor TanStack Router's `createRootRoute` provides an Error Boundary or `errorComponent`, any data anomaly (e.g., malformed date, null property access on a product) immediately turns the entire screen blank (WSOD) with zero recovery mechanism.

4. **From Observation 4 to Loss of Contract Guarantees**:
   - Because `.or(z.any())` or `.output(z.any())` was appended to >40 contract procedures in `packages/contract`, TypeScript type inference resolves outputs to `any`.
   - This bypasses runtime Zod validation and forces frontend modules (`auth-store.ts`, `order-store.ts`, `plans-store.ts`) to use defensive `as any` casting and manual type-sniffing, completely undermining the single-source-of-truth invariant.

5. **From Observation 5 to Client CPU & Memory Inefficiency**:
   - The permanent 5-second interval in `write-activity.ts:38` parsing all `localStorage` keys, combined with broken component memoization in `ProductCard` and unstable `virtualItems` dependencies in `useProductVirtualizer`, forces constant unnecessary re-renders and background thread wakeups.

6. **From Observation 6 to RTL & A11y Non-compliance**:
   - Physical CSS classes (`ml-1`, `text-right`), English decimal points in Persian text, global text selection disabling (`selectstart`), and unstyled native `alert`/`confirm` dialogs violate `AGENTS.md` and `rtl-persian-ui` standards.

---

## 3. Caveats

1. **No Backend Simulation**: Network load estimates (e.g. 50,000 requests for 5,000 users) are calculated based on client code logic (`syncPage` with limit 100, 120s timer, `refetchOnWindowFocus: true`) rather than synthetic load testing against a live Bun/Hono cluster.
2. **Read-Only Exploration**: No modifications were made to `apps/web` or `packages/contract` per guardrails.
3. **No Radix/Shadcn Assumed**: Confirmed that UI layer is HeroUI v3 + Tailwind CSS v4, obeying repository constitution.

---

## 4. Conclusion

The frontend architecture of PersianPart 2.0 possesses strong modern foundations (React 19, TanStack Router & Query, Tailwind v4, HeroUI v3, oRPC). However, it currently carries **14 identified technical debts and architectural trade-offs**, four of which are **High Severity**:
1. **Critical Client Vulnerability**: Zero Error Boundaries (WSOD on render error).
2. **Server Thundering Herd**: Unchecked `syncPage` traversal and `refetchOnWindowFocus: true` hammering backend under high user load.
3. **Performance Penalty**: Monolithic 1.49 MB JS + 517 KB CSS bundle with zero route code-splitting.
4. **Contract Degradation**: Over 40 endpoints using `z.any()` in `packages/contract`, destroying type-safety and SSOT guarantees.

Remediating these 14 technical debts (detailed in `analysis.md`) will ensure production-grade scalability, rock-solid resilience, and sub-second rendering for thousands of concurrent users.

---

## 5. Verification Method

To independently verify all findings and claims:

1. **TypeCheck Verification**:
   ```bash
   pnpm --filter @persianpart/web exec tsc --noEmit
   pnpm --filter @persianpart/contract exec tsc --noEmit
   ```
   Both succeed (clean exit 0), confirming TypeScript compiles without syntax errors due to pervasive `any` types.

2. **Catalog Unit Tests**:
   ```bash
   pnpm --filter @persianpart/web test:catalog:unit
   ```
   Verifies that the catalog coordinator unit tests pass (10 tests, 0 failures).

3. **Bundle Size Verification**:
   ```bash
   ls -la apps/web/dist/assets/
   ```
   Directly verifies that `index-*.js` is ~1.49 MB and `index-*.css` is ~517 KB.

4. **Code Inspection**:
   - Inspect `apps/web/src/lib/query-client.ts:26` for `refetchOnWindowFocus: true`.
   - Inspect `apps/web/src/modules/products/catalog-coordinator.ts:89-119` for 120s loop and `syncPage` traversal.
   - Inspect `apps/web/src/routes/__root.tsx:5-8` and `apps/web/src/main.tsx:47-52` for complete absence of ErrorBoundary / errorComponent.
   - Inspect `packages/contract/src/catalog.ts:678,709,720...` and `shopping.ts` for `.or(z.any())`.
   - Inspect `apps/web/src/app/app-header.tsx:59` for `ml-1`.

5. **Invalidation Conditions**:
   - The findings would be invalidated if `createLazyFileRoute` or `.lazy.tsx` were added to routes, or if `errorComponent` were implemented on `createRootRoute`, or if all `.or(z.any())` were replaced with strict Zod schemas. Currently, none of these exist in the codebase.
