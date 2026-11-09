---
name: rtl-persian-ui
description: Persian RTL rules for apps/web. Load when writing or reviewing Persian-facing UI, layout, numbers, currency, dates, ZWNJ, or mixed-direction text.
---

# Persian RTL UI rules (apps/web)

## Document direction and mixed text

- `apps/web/index.html` sets `<html lang="fa" dir="rtl">`. Keep page direction RTL; do not flip it per route or layout.
- Isolate phone numbers, SKUs, part codes, and URLs in a local `dir="ltr"` wrapper. Existing examples include `src/modules/auth/login-card.tsx` and `src/modules/products/product-bottom-sheet.tsx`.
- Use `<bdi>` or an explicit direction wrapper when Persian text contains a value whose direction could reorder, such as a measurement followed by a Latin unit.

## Logical layout

- Prefer logical utilities: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `border-s-*`/`border-e-*`, `rounded-s-*`/`rounded-e-*`, and `text-start`/`text-end`.
- Do not add physical left/right margin, padding, positioning, or text-alignment utilities to new code. Convert an existing physical utility when touching that layout.
- Follow the app's mobile-first layout and existing safe-area utility (`pb-safe`). Inspect the actual screen rather than assuming a directional icon or scroll region mirrors automatically.

## Numbers, currency, and dates

Use the existing helpers in `src/lib/utils/currency.ts` and `src/lib/utils/date.ts`; do not add separate formatters or hand-roll digit conversion.

- `toPersianDigits(value)` converts ASCII digits in a string or number to Persian digits.
- `formatNumber(value)` uses `en-US` grouping and keeps Latin digits. Use it only where that output is intended, or pass its output through `toPersianDigits` for Persian display.
- `formatToman(value)` applies `formatNumber` and Persian digit conversion. It returns the formatted amount only; the caller supplies the unit label.
- `formatSquareMeters(value)` rounds to at most two decimal places and displays Persian digits.
- `formatPersianDate`, `formatPersianDateLong`, `formatPersianDateTime`, and `formatPersianTimelineTs` in `date.ts` format dates with the Persian calendar. Use the existing helper that matches the UI's date/time shape.
- `formatPlanRemainingTime` owns the existing Persian plan-expiry wording and time calculation.

Use Persian digits in Persian-facing display, but keep identifiers, query keys, API payloads, and code literals in their canonical form. Do not rewrite digits while a user types; localize on display.

## Persian copy and selection

- Use ZWNJ (U+200C) for نیم‌فاصله, not a regular space. Use Persian punctuation (`،`, `؛`) in Persian sentences and retain Latin punctuation inside identifiers.
- The app disables selection globally. Keep selectable content inside inputs/editable areas or mark intentional selectable content with `data-selectable="true"`.

## Fonts and visual verification

Reuse the existing Vazirmatn font stack and CSS variables in `src/styles/globals.css`; do not add another Persian font family.

For changed customer-facing screens, inspect a narrow viewport and desktop width. Check for horizontal overflow, bidi reordering, numeral direction, and mirrored directional icons. Run `pnpm --filter @persianpart/web exec tsc --noEmit` and `pnpm --filter @persianpart/web build` when the change affects React or styles; report checks actually run.
