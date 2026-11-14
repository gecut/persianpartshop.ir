# PWA behavior and verification

Implemented scope: install/update UI, offline application shell and catalog, account isolation, explicit logout cleanup, text drafts, query error/retry/refetch states, virtual-list navigation restoration, and direct product links. No push, service-worker API cache, automatic order replay, or offline order acceptance.

## Ownership

- TanStack Query owns server data. IndexedDB retains the product lookup catalog and the latest successful response for the first 24 products in the unfiltered, default-sorted list. Each expires 48 hours after its own server checkpoint. The list restores the exact saved server page and revalidates it in the background when online. Logout, account changes, and confirmed catalog scope changes discard both records. During offline use, server-side access changes become known on reconnect.
- `persianpart_text_v1:<account>:<form>` stores account-scoped cart notes and profile text; the existing `persianpart_draft_v3:<account>` remains the cart owner.
- Explicit logout deletes that account's cart and text drafts. Session expiry preserves drafts for the same account. Other accounts cannot restore them.
- Text is written after 300 ms and flushed on blur, page hide and user-requested update. Failed storage shows an unsaved warning and blocks update when the flush fails. Browser storage is not a server backup.
- Private plans are no longer restored from the legacy shared local-storage key.
- Successful HTTP delivery is not order confirmation. Network errors preserve the existing idempotency identity; unknown outcomes are surfaced, not automatically replayed.

## Installation and upgrades

The generated manifest uses `/product` and standalone Persian/RTL presentation. The one-time installation invitation follows successful login; manual install/help remains in Account. The application provides platform instructions when the browser cannot offer a native prompt.

Updates use the generated Workbox worker in prompt mode. A dismissed update banner returns on the next app load; Account always exposes the pending update. Update and explicit logout are blocked during active writes. Cross-tab write activity uses bounded storage heartbeats and BroadcastChannel notifications with storage-event fallback. Old heartbeat entries expire after 35 seconds, alongside the 30-second request timeout.

The worker precaches the application shell, local font, install icons, image placeholder and QR assets. From the install or update dialog, a signed-in customer can prepare an offline package containing the full permitted catalog, dimensions, plans, order and supply history with details, profile and document status, and authorized QR codes. The dialog reports work completed, and an interrupted download can be resumed after reload. IndexedDB publishes one completed package at a time. Its public product images use a separate Cache Storage namespace that survives worker updates.

The package expires seven days after completion or when the server-issued offline access window ends, whichever comes first. Account changes, logout and confirmed catalog scope changes invalidate it. The first-page cache remains a fallback for existing installations. API responses are not cached by the worker. Opening private documents, live quotes and server writes requires connectivity. Saved prices and stock reflect the last download.

## Direct links and navigation

`/product?productId=<positive-numeric-id>` opens the existing product sheet, including a product outside the initial list. Access is still checked for the current account. Login preserves the destination.

TanStack Router restores scroll position; account-scoped session view state preserves list depth and the orders tab. Product filters retain their existing nuqs ownership.

## Verification and deployment

From repository root:

- `pnpm --filter @persianpart/web build`
- `pnpm --filter @persianpart/api exec tsc --noEmit`
- `pnpm --filter @persianpart/web test:catalog:unit`

For a local browser smoke test, start the production preview on port 55177, open `http://localhost:55177/login` in a fresh Playwright CLI session, then run `pnpm exec playwright-cli run-code --filename=apps/web/tests/offline-browser.smoke.js` from the repository root. The script supplies fixture API and image responses and switches the browser offline after preparing the package.

The web container now owns its nginx configuration: HTML, manifest and worker require revalidation, hashed assets are immutable, missing assets/API paths return 404 rather than HTML. Production must provide HTTPS and route the configured API/CDN origins correctly. Reverse proxies must preserve these policies. The build does not establish real-device installation or the live proxy configuration.

Rollback must continue serving a valid worker at `/sw.js`; removing the file alone does not uninstall existing workers. If PWA support is deliberately withdrawn, use a cleanup worker at that URL before removing it.

Deploy the additive session and catalog contracts before the web build. On staging, measure image count, bytes, CORS behavior, elapsed time and storage on the real CDN. In installed Chrome Android and iOS Safari, prepare the package, disconnect, close and reopen, and exercise catalog filters, the full gallery, QR scanning and exports, history, plans and document status. Repeat with a failed image, a refresh with an existing package, two tabs and a changed account. Report phase, counts, duration and error category without recording account data, QR payloads or private URLs.
