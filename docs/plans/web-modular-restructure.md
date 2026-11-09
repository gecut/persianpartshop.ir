# apps/web — Modular Restructure Plan

Status: **executed (Phases 0–5)**. Deviations: trivial `loader` in `orders/$id` stays in the route file; `validateSearch` bodies moved to `*-search.ts`; `login`'s theme-color effect moved verbatim into `LoginView`; Phase 1 also left `lib/utils.ts` (still used). Executed under `nexload-reasoning-execution`; code rules from `nexload-code` / `nexload-react`; CSS/visual lock from `nexload-design`; final gate `nexload-cto-review`.

## Settled decisions (immutable)

1. UI is locked: no visual, behavioral, route-path or route-id change.
2. Structure: `routes/` (layout only) → `app/` (shell) → `modules/*` (features + `*.view.tsx` pages) ; `components/` and `lib/` stay at current paths (AGENTS.md, `rtl-persian-ui`, `tanstack-query-best-practices` pin `src/lib/*`).
3. Dead code is removed in its own commit, separate from moves.
4. Large non-route files (`profile-view`, `counter`, `slide-commit`, `code-slots`, `product-bottom-sheet`…) are moved only; splitting them is a later task.
5. No barrels (`index.ts`); direct imports. `@/` between modules, relative inside a module.
6. Filenames kebab-case; page files are `<name>.view.tsx`; module-private files start with `_`.

## Target layers and allowed imports

| Layer | May import |
| :-- | :-- |
| `routes/*` | `modules/*` (non-`_` files), `app/*` |
| `app/*` | `modules/*`, `components/*`, `lib/*` |
| `modules/X/*` | `components/*`, `lib/*`, other modules' non-`_` files; never `routes/*`, never other modules' `_` files |
| `components/*`, `lib/*` | each other only (`components` → `lib`); never `modules/*` or `app/*` |

Route file contract: `createFileRoute(path)` + `validateSearch`/`loader`/`beforeLoad` wiring + `component: XView`. Search-schema parsers and loader bodies live in the module (`*-search.ts`, `*-loader.ts`) and are imported by the route. Views read params/search with `getRouteApi('<id>')` so modules never import `routes/`.

## Target tree

```text
src/
  main.tsx
  routes/            __root, index, login, account, cart, plans, product(.tsx layout), product/{index,new,supply/$id}, orders/{index,$id}   (paths unchanged)
  app/               root-layout.view.tsx, app-header.tsx, mobile-bottom-nav.tsx, use-session-sync.ts, auth-guard.ts
  modules/
    auth/            login.view.tsx, login-card.tsx, auth-store.ts
    account/         account.view.tsx, profile-view.tsx (moved as-is)
    products/        product-list.view.tsx, product-new.view.tsx, product-search.ts, product-types.ts, use-session-value.ts,
                     catalog-{coordinator,data,mapper}.ts, product-{store,card,config-card,bottom-sheet,filters}…, selection-store.ts,
                     filter-drawer.tsx, dimension-filter.tsx, product-qr-*.tsx, qr-frame.ts
    cart/            cart.view.tsx, cart-store.ts, cart-item-row.tsx, warehouse-selection.tsx
    checkout/        cart-summary.tsx, cart-totals.ts, checkout-*.tsx, pre-invoice-modal.tsx
    orders/          activity-feed.view.tsx, order-detail.view.tsx, orders-search.ts, order-types.ts,
                     _activity-order-card.tsx, _activity-supply-card.tsx, order-store.ts, order-timeline.tsx, order-invoice-modal.tsx, use-submit-order.ts
    plans/           plans.view.tsx, plan-card.tsx, plans-store.ts, plan-types.ts
    supply-requests/ supply-request.view.tsx, supply-request-{form,draft,modal,recovery}…, use-supply-submission.ts
    pwa/             pwa-controls.tsx
  components/ lib/ styles/   (unchanged)
```

`types/{product,order,plan}.ts` move into the owning module; contract re-exports in `types/index.ts` are re-pointed to direct `@persianpart/contract` imports at their 22 consumers (decide per file in Phase 3; no new shared `types/` layer).

## Verification contract (every phase gate)

Narrowest → outward. A phase is "done" only with output shown for:

1. `pnpm --filter @persianpart/web exec tsc --noEmit`
2. `pnpm --filter @persianpart/web build`
3. **CSS lock:** sha256 of the built `dist/assets/*.css` identical to baseline (phases 2–5 except dead-code phase 1, which re-baselines). If the hash differs, compare sorted rule sets before declaring failure — only ordering noise is acceptable, never added/removed rules.
4. `git diff --stat src/routeTree.gen.ts` empty (route ids/paths unchanged).
5. `pnpm --filter @persianpart/web exec bun test tests` (existing two suites, imports updated).
6. Boundary check (ad hoc grep, not committed): no `components|lib → modules|app`, no `modules → routes`, no cross-module `_` imports.
7. Visual: reference screenshots at mobile width (390×844) for every route, before vs after, via built-in browser. [UNKNOWN] needs API reachable; if not, state it and rely on 3 + `vite preview` smoke of `/login`.

Each phase = one commit; failure → revert that commit and route back to the earliest invalid layer (execution skill's recovery router).

## Phases

### Phase 0 — Baseline (no code change)
- `pnpm install`; record tsc/build results (currently [UNKNOWN]; `node_modules` missing).
- If baseline is red, stop: report to user before any move.
- Save: CSS hash, `routeTree.gen.ts` copy, `dist` file list, bundle sizes, screenshots.
- Build twice to confirm CSS hash is deterministic (else switch gate 3 to sorted-rule comparison).

### Phase 1 — Dead code removal (own commit, own baseline)
Confirmed no importers: `components/ui/hold-button.{tsx,css}`, `features/products/order-entry-modal.tsx`, `features/supply-requests/supply-request-list.tsx`, `features/calculator/carton-calculator.tsx`, `features/plans/plan-modal.tsx`, `hooks/` (all barrel + `useAuth/useCart/useOrders/useProducts/useDebounce/useRafThrottle`; keep `use-session-value.ts`), `lib/utils.ts` re-check usage first.
- Re-verify each with a fresh grep immediately before deleting.
- Expected: CSS hash **may change** (Tailwind scans unused files). Accept only removal of rules that exist solely in deleted files; record new baseline.
- Remove now-unused dependencies only if nothing else imports them (e.g. carton-calculator-only deps) — otherwise leave.

### Phase 2 — Mechanical rename `features/` → `modules/` + alias
- `git mv src/features src/modules`; rewrite imports to `@/modules/...`, `@/components/...`, `@/lib/...` with a scripted codemod (cross-directory) and keep same-folder imports relative.
- No file content changes beyond import specifiers. Gates 1–6.

### Phase 3 — Types and hooks relocation
- `types/product.ts → modules/products/product-types.ts`, `order.ts → modules/orders/order-types.ts`, `plan.ts → modules/plans/plan-types.ts`; fix the 22 consumers; delete `types/`.
- `hooks/use-session-value.ts → modules/products/use-session-value.ts`; delete `hooks/`.
- `components/layout/*` → `app/` (they depend on `modules/auth`; moving them removes the layer violation). `components/` then has only `ui/` and `feedback/`.
- Resolve the cycles/violations found in analysis only where the layer rules force it (products↔auth, products↔cart): prefer moving the shared symbol to its owner over adding abstractions; if unavoidable, record as a known exception in the plan rather than inventing a layer.

### Phase 4 — Route → view extraction (smallest first, one commit each)
Order: `login` → `account` → `plans` → `product/supply/$id` → `product/new` → `cart` → `orders/$id` → `orders/index` → `product/index` → `__root`.
Per route:
1. Move the component body to `modules/<m>/<name>.view.tsx` (named export, named props if any; trivial inner helpers stay, significant ones become `_` files, e.g. `_activity-order-card.tsx`).
2. Move `validateSearch` parsers/types to `<name>-search.ts`, loader logic to the module; route imports them.
3. Replace `Route.useParams()/useSearch()` in the view with `getRouteApi('<same id>')`.
4. Route file shrinks to wiring. No JSX or className edits — the diff in moved code must be import/identifier-only (review with `git diff -M --color-moved`).
`__root`: split into `app/auth-guard.ts` (`beforeLoad`), `app/use-session-sync.ts` (session query + effects), `app/root-layout.view.tsx` (layout JSX); effect order and `Outlet key` preserved exactly.
Pure-presentational `routes/product.tsx` (Outlet layout) and `routes/index.tsx` (redirect) stay as-is.

### Phase 5 — Tests, docs, final review
- Update `tests/*.ts` import paths; run suites.
- Update `AGENTS.md` (new structure section, layer table, `.view.tsx` rule), `CLAUDE.md` if needed, and skill pointers that name paths (`rtl-persian-ui`, `tanstack-query-best-practices` stay valid since `lib/` is unchanged).
- Full gate set once more + screenshot diff of all routes.
- `nexload-cto-review` on the final diff (review-only, ≤3 findings); address findings in a follow-up commit.

## Risks

| Risk | Mitigation |
| :-- | :-- |
| Baseline already red / no API for screenshots | Phase 0 stop-and-report; fall back to CSS hash + build + preview smoke |
| Tailwind output changes from file moves | Gate 3 after every phase; investigate before proceeding |
| Import cycles surface as runtime init-order bugs (no barrels reduces this) | Direct imports only; smoke `vite preview` on `/login` and `/product` each phase |
| `getRouteApi` typing / id mismatch | tsc gate; ids copied from existing `createFileRoute` strings |
| Case-insensitive FS (macOS) on renames | Use `git mv`; avoid case-only renames (all targets are already kebab-case) |
| Hidden path references (Dockerfile, vite/PWA config, docs) | `grep -rn "src/features\|src/hooks\|src/types"` repo-wide in Phase 2 and 5 |

## Out of scope
Splitting large components, behavior fixes, dependency upgrades, adding lint/test tooling, `apps/api`, `apps/cms`, `packages/*`.
