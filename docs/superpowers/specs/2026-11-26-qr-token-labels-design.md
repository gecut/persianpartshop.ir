# QR token labels and label design

Date: 2026-11-26 · Status: approved in conversation (design). Implementation plan: `docs/superpowers/plans/2026-11-26-qr-token-labels.md`.
Label artwork reference: `qr-label-design-assets/approved-template-60x80mm.png` (approved look), `reference-render-label.mjs` (working renderer to port), `reference-measure-gaps.mjs` (spacing check).

## 1. Intent and why
Printed QR labels in physical stores carry a raw per-product `scanCode`. A customer's camera shows plain text and each code is hard-wired to one product. The business wants labels that (a) take a customer to the public catalog page of the product, (b) keep working for staff inside the web app, (c) can be re-bound to another product at any time, and (d) look attractive and formal enough to make a passer-by scan. Old printed codes are discarded.

## 2. Settled decisions (immutable unless new contradicting evidence)
- **Hard cutover.** No legacy-code reader, no dual mode, no gradual migration of printed labels.
- **Opaque tokens.** A label carries a random 8-char token, never a product identifier. Binding lives in the CMS and is editable. Many tokens may point to one product (one label per store). A token may be unbound (printed in advance).
- **QR payload:** `HTTPS://<CATALOG HOST>/Q/<TOKEN>`, entire string uppercase so the QR uses alphanumeric mode (33×33 modules at error-correction H instead of 41×41). Catalog accepts `/Q/…` and `/q/…`, case-insensitive token.
- **Token alphabet:** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 symbols, no `0 1 I L O`), length 8.
- **Who edits:** only `manager` and `superadmin` create/bind/rebind; any authenticated admin (including the `service` account) reads; nobody deletes (deactivate with `isActive`).
- **CMS collection `qr-codes`:** `token` (unique, immutable, auto-generated), `product` (optional relationship), `store` (≤120), `note`, `isActive` (default true). Admin list: search + selection; detail page shows a live label preview and the full URL.
- **Admin actions:** generate N tokens (1–500) with an optional store name; export the selected rows as a ZIP of print-ready PNGs (max 500).
- **Staff scanning** in the web app stays gated by the existing `canUseProductQr` permission; the in-app scanner reads the token from the URL; the offline package carries `token → productId`. QR download leaves the web app (labels are produced only in the CMS).
- **Customer experience:** a valid, active, bound token whose product is published → temporary redirect to `/p/<id>`. Unbound, inactive, unknown, or unpublished-product token → friendly Persian "this code is not active" page. One generic internal error code (`QR_INACTIVE`) so existence of a token is never revealed.
- **Two-release data migration:** Release 1 = code + additive migration creating `qr_codes` (the old `products.scan_code` column stays, unused). Release 2 = separately authorized migration dropping `products.scan_code`. Reason: during a rolling deploy old containers may still read the column; dropping it early breaks them. The `users.can_use_product_qr` column is kept.

## 3. Label design (final, approved)
Printed on white plexiglass, cut by the print shop. The artwork is one opaque PNG per token.
- **Size: exactly 60 mm × 80 mm = 2400 × 3200 px at 1016 dpi**, sRGB, opaque white, no transparency/blends/shadows/gradients (UV print).
- **Colors:** brand red `#ae0f17` (finder eyes and border), black `#14120f` (data modules and caption). Font: Peyda Medium (`apps/cms/public/fonts/PEYDA-MEDIUM.TTF`).
- **Code:** 33×33 modules, EC level H, ≈ 48.8 mm square (module ≈ 1.478 mm). Finder eyes: red octagonal rings (ring + white gap + solid centre). Data modules: black "liquid" shapes (adjacent modules fuse into rounded forms); function patterns (timing/alignment) are plain squares. No centre logo.
- **Frame:** thin red border (stroke 0.30 module ≈ 0.44 mm) with clipped corners (2 modules); border centreline 0.65 module (≈ 0.96 mm) inside the cut line.
- **Spacing rule (measured on the final PNG):** left/right gap between border inner edge and code = **3.0 modules**; top gap, code→caption gap and caption→bottom gap are **equal to each other and solved so the sticker is exactly 80 mm tall (≈ 4.32 modules ≈ 6.4 mm)**. A uniform gap on all four sides is impossible at 60×80 without shrinking the code or adding an element; this was reviewed and accepted.
- **Caption (two lines, both exactly code-width = 33 modules, centred):** headline `قیمت و ویژگی‌های کالا` (1.5× the size of the second line, kashida-justified with `ـ` to fill the width) and sentence `برای مشاهدهٔ جزئیات کامل، اسکن کنید`. Formal register, no exclamation marks. The word «کالا» is used instead of «محصول».
- **Verified:** decodes with two independent decoders (jsQR, ZXing) at full size, at 3 cm and 2 cm sticker width, with blur, grayscale, ±8° rotation, perspective, JPEG Q60, dimming and noise. jsQR alone fails on the 2400-px original for an unrelated library reason (it passes at ≤1800 px); ZXing passes at every size. **Not yet verified:** physical print on plexiglass, real phones in dim shop light, UV ink spread.
- **Rejected alternatives (history):** framed variants with banners and logo (too busy); centre emblem logo (failed to scan with some masks and was too small to see); darker red `#820b12` (looked dead); 60×74 mm label (superseded by the exact 60×80 requirement).

## 4. Goals, non-goals, anti-goals
- **Goals:** re-bindable many-to-one tokens, search + detail in the admin, print-ready PNG ZIP, complete removal of the old scan system, a data migration that cannot corrupt existing data.
- **Non-goals:** scan analytics, per-store reports, vector/PDF output, a bridge for old labels, a human-readable product code scheme.
- **Anti-goals:** any change that can lose or alter products/users data; any state where two readers disagree about what a token means; a label that stops scanning because of styling.

## 5. Constraints
- Monorepo rules in `AGENTS.md` (strict TypeScript, contract is the single source of API shapes, hand-written migrations registered in `apps/cms/src/migrations/index.ts`, `push: false`, no unprompted commits).
- Payload forces `RESTRICT` foreign keys on business relations; the hand-written SQL must match.
- Never use `migrate:down` operationally; always take a backup and rehearse each migration on a clone.
- Public catalog is `noindex`; `/Q/<token>` must stay dynamic (no ISR) so re-binding is immediate.

## 6. Known open items for the implementer
1. Admin list search on the relationship path `product.name` is unverified; fallback is a denormalized read-only `productName` field.
2. `useSelection` inside `beforeListTable` must be confirmed against the installed `@payloadcms/ui` version.
3. The uppercase `/Q/` path needs a Next `rewrites()` entry (routes are case-sensitive); confirm it runs before the root optional catch-all.
4. The Peyda font must be traced into the CMS standalone build; confirm with a real export.
5. Add a rate-limit note/proxy rule for `/Q/*` like the existing `browse` limit.
