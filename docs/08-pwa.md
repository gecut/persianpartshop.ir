# PWA behavior and verification

Implemented scope: install/update UI, offline application shell and catalog, account isolation, explicit logout cleanup, text drafts, query error/retry/refetch states, virtual-list navigation restoration, and direct product links. No push, service-worker API cache, automatic order replay, or offline order acceptance.

## Ownership

- TanStack Query owns server data. Only the catalog query is persisted to IndexedDB for up to 48 hours from the last successful checkpoint. A first-page checkpoint can serve an incomplete catalog until the first full sweep succeeds. Logout, account changes, and confirmed catalog scope changes discard the old version. During offline use, server-side access changes become known on reconnect.
- `persianpart_text_v1:<account>:<form>` stores account-scoped cart notes and profile text; the existing `persianpart_draft_v3:<account>` remains the cart owner.
- Explicit logout deletes that account's cart and text drafts. Session expiry preserves drafts for the same account. Other accounts cannot restore them.
- Text is written after 300 ms and flushed on blur, page hide and user-requested update. Failed storage shows an unsaved warning and blocks update when the flush fails. Browser storage is not a server backup.
- Private plans are no longer restored from the legacy shared local-storage key.
- Successful HTTP delivery is not order confirmation. Network errors preserve the existing idempotency identity; unknown outcomes are surfaced, not automatically replayed.

## Installation and upgrades

The generated manifest uses `/product` and standalone Persian/RTL presentation. The one-time installation invitation follows successful login; manual install/help remains in Account. The application provides platform instructions when the browser cannot offer a native prompt.

Updates use the generated Workbox worker in prompt mode. A dismissed update banner returns on the next app load; Account always exposes the pending update. Update and explicit logout are blocked during active writes. Cross-tab write activity uses bounded storage heartbeats and BroadcastChannel notifications with storage-event fallback. Old heartbeat entries expire after 35 seconds, alongside the 30-second request timeout.

The worker precaches the application shell, local font, install icons and image placeholder. Public catalog images with a successful CORS response use a separate cache capped at 100 entries and seven days. API, document uploads, QR binaries and unrecognized navigations are not offline fallbacks. A warm start displays the saved catalog without a skeleton. An offline start without catalog data shows connection guidance. Saved prices and stock reflect the last download and require live validation for ordering.

## Direct links and navigation

`/product?productId=<positive-numeric-id>` opens the existing product sheet, including a product outside the initial list. Access is still checked for the current account. Login preserves the destination.

TanStack Router restores scroll position; account-scoped session view state preserves list depth and the orders tab. Product filters retain their existing nuqs ownership.

## Verification and deployment

From repository root:

- `pnpm --filter @persianpart/web build`
- `pnpm --filter @persianpart/api exec tsc --noEmit`
- `pnpm --filter @persianpart/web test:catalog:unit`

The web container now owns its nginx configuration: HTML, manifest and worker require revalidation, hashed assets are immutable, missing assets/API paths return 404 rather than HTML. Production must provide HTTPS and route the configured API/CDN origins correctly. Reverse proxies must preserve these policies. The build does not establish real-device installation or the live proxy configuration.

Rollback must continue serving a valid worker at `/sw.js`; removing the file alone does not uninstall existing workers. If PWA support is deliberately withdrawn, use a cleanup worker at that URL before removing it.
