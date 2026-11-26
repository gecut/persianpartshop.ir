# Merged Phased Plan — Pre-Invoice + QR Token Labels (2026-11-26)

Sources (the step-by-step detail lives there; this file only orders and groups it):
- **PI** = `docs/superpowers/plans/2026-11-26-pre-invoice-best-practice.md`
- **QR** = `docs/superpowers/plans/2026-11-26-qr-token-labels.md` (spec: `docs/superpowers/specs/2026-11-26-qr-token-labels-design.md`)

## Operating model

- Branch: `main` (no new branch). No push.
- Director: Claude. Executor: Antigravity `agy-delegate --tier flash --effort medium --mode accept-edits|--yolo --dir .`.
- After each phase: `/antigravity:review` (Hydrogen High = `--tier flash --effort high`) on that phase's diff. Open findings become **Task X.0** of the next phase.
- Director runs each phase gate itself (never trusts executor "GREEN"), then makes **one commit per phase** (Conventional Commits) with only that phase's paths.
- After the last phase: Claude runs `/code-review`, leaves the director role and fixes remaining findings itself.

## Merge analysis

- **Overlap:** PI touches `apps/web/src/modules/orders/**`, `modules/checkout/pre-invoice-modal.tsx`, `styles/globals.css`, `packages/contract/src/order.ts`. QR touches `packages/contract/src/{catalog,public-catalog,offline}.ts`, `apps/web/src/modules/{catalog,pwa,products,plans}/**`, `src/sw.ts`, `apps/web/package.json`, CMS, API, catalog. No file is shared → PI runs first (small, web-only, keeps `tsc` green) before QR breaks cross-package compile in QR Task 1.
- **Rule conflicts resolved:** PI "commit per task" and QR rule 7 "never commit" → replaced by *director commits once per phase*. Executors never run `git commit`/`push`/branch commands.
- **Excluded:** QR Task 14 (Release 2) — only on explicit human request. PI "Open questions" — out of scope.
- **Environment:** Docker daemon is off → QR Task 5 Step 5 (migration rehearsal) and QR Task 13 Step 5 (running stack E2E) are recorded **NOT DONE** (human decision). PI Task 7 Step 4 / PI Task 9 manual print check need a browser + data; attempt with the dev server, else NOT DONE.
- **Pre-existing dirty files not part of this work** (`.enola/**`, `.agents/**`, `.codex/`, `scripts/`, `.qr-design-spike/`) are never staged.

## Phase 0 — Baseline and already-applied fixes
- 0.1 QR Task 0 (baseline: `git status`, `pnpm install --frozen-lockfile`, `pnpm check-types`, `pnpm test:unit`).
- 0.2 PI Task 1: verify `tsc`, commit the 8 already-modified web files.
- Gate: baseline green. Commit: `fix(web): simplify pre-invoice header, buyer card and signatures`.

## Phase 1 — Pre-invoice (web only)
- 1.1 PI Task 2 — `_invoice-format.ts` + tests.
- 1.2 PI Task 3 — typed `order-mapper.ts` + tests, `CustomerOrderDocument` type in contract.
- 1.3 PI Task 4 — native print-safe items table + print CSS.
- 1.4 PI Task 5 — totals + amount in words.
- 1.5 PI Task 6 — header validity + copy fixes.
- 1.6 PI Task 7 — modal a11y, Escape, scroll lock, `afterprint`.
- 1.7 PI Task 8 — drop fixed system note.
- Gate: web `tsc --noEmit`, web `test:unit`, web `build`. Commit: `feat(web): make printable pre-invoice typed, accessible and print-safe`.

## Phase 2 — QR foundations (contract, token, label renderer)
- 2.0 Review carry-over from Phase 1.
- 2.1 QR Task 1 — contract (`QrTokenSchema`, `qr` operation, offline `qr` map).
- 2.2 QR Task 2 — CMS token module (`_token.ts`, `_pick-tokens.ts`).
- 2.3 QR Task 3 — label renderer (`modules/qr-label/*`, deps, Next config).
- Gate: the new contract/CMS unit tests pass; `tsc` for `packages/contract` clean; CMS `tsc` no errors in `qr-label`. Cross-package compile errors from 2.1 are expected until Phase 5.
- Commit: `feat(qr): add token contract, token module and label renderer`.

## Phase 3 — QR data model (collection, migration)
- 3.0 Review carry-over from Phase 2.
- 3.1 QR Task 4 — `qr-codes` collection, access, remove `products.scanCode` field, regenerate types.
- 3.2 QR Task 5 Steps 1–4 — expand migration `20261125_120000_qr_codes.ts` + register. Step 5 rehearsal: NOT DONE (no Docker).
- Gate: CMS `_access` test, CMS `tsc --noEmit` clean.
- Commit: `feat(cms): add qr-codes collection and expand migration`.

## Phase 4 — QR CMS behavior (resolve, labels, admin UI)
- 4.0 Review carry-over from Phase 3.
- 4.1 QR Task 6 — CMS `qr` operation (`catalog-qr.ts`, service, endpoint).
- 4.2 QR Task 7 — label endpoints (generate, ZIP export, preview).
- 4.3 QR Task 8 — admin UI (`_selected-ids`, export, preview, search by product name; record shipped variant).
- Gate: CMS `test:unit` 0 failures, CMS `tsc --noEmit` clean.
- Commit: `feat(cms): resolve qr tokens and export printable labels`.

## Phase 5 — QR consumers (API, catalog, web)
- 5.0 Review carry-over from Phase 4.
- 5.1 QR Task 9 — API `getByQrToken`, `listQrTokens`, offline data, scope key.
- 5.2 QR Task 10 — catalog `/Q/<token>` route + inactive page.
- 5.3 QR Task 11 — web scanner/offline token map; delete `product-qr-download.tsx`.
- Gate: `pnpm check-types` clean; `pnpm test:unit` 0 failures.
- Commit: `feat(qr): resolve tokens in api, public catalog and web scanner`.

## Phase 6 — Docs and whole-feature verification
- 6.0 Review carry-over from Phase 5.
- 6.1 QR Task 12 — docs.
- 6.2 QR Task 13 Steps 1–4, 6 + PI Task 9 (check-types, test:unit, web + catalog build, restore `next-env.d.ts`, `scan_code` stays). QR Task 13 Step 5 E2E: NOT DONE.
- Commit: `docs: describe qr token labels and rollout`.

## Phase 7 — Director exit
- `/code-review` on all phase commits; Claude fixes findings directly; re-run gates; final commit if needed; final report with NOT DONE list.
