# Public Catalog

## Boundaries and ownership

Catalog is an independent public product viewer: browse, search/filter, details and sharing. It has no login, cart, ordering, PWA or offline package, and never links to or imports Web. Neither application's Dockerfile copies the other application's manifest/source. Each owns its formatting and brand tokens; CMS owns preview formatting. Small presentation duplication is intentional to keep the applications independent.

Browser → Catalog browse handler → server-only `@payloadcms/sdk` → CMS → PostgreSQL. SSR uses the same SDK reader directly. The existing active `admins/service` API key authenticates CMS requests; visitor cookies and Authorization are never forwarded. The commerce Hono/oRPC API is outside this path. Its authenticated Web product APIs and CMS's existing commerce SMS configuration are separate concerns.

CMS owns the single publication compiler, parameterized derived-price/stock query, public field-by-field mapper and preview. Filtering/counting/sorting happen before pagination. Local API hydration preserves access control; raw products remain restricted to authorized staff/service identities. Public schemas live at `@persianpart/contract/public-catalog`, outside the commerce contract root.

## Routes and structure

| Owner | Route | Responsibility |
| --- | --- | --- |
| Catalog | `/` | First 24 products in HTML; interactive URL filters and pagination |
| Catalog | `/p/[identifier]` | Stable positive ASCII numeric product identifier |
| Catalog | `POST /api/catalog/browse` | Only anonymous data endpoint; validated input, 64 KiB limit, no-store and cancellation |
| Catalog | `/health` | Process health independent of CMS/product data |
| CMS | `POST /api/catalog/:operation` | Active service account only; bootstrap, browse and product |
| CMS | `POST /api/catalog-preview` | Unsaved manager/superadmin preview and explanation, using the real Payload session |
| CMS | `GET /api/catalog-location` | Authorized admin link to Catalog |

The root optional catch-all accepts only an empty path; unknown paths return the Persian 404. It is retained to defer page generation to runtime. Sitemap/robots routes and standalone facets operations do not exist; filter options accompany browse/bootstrap.

`app/` contains Next wiring/layout/error boundaries. `modules/catalog/` owns list/filter/card behavior, URL/query lifecycle and scroll restoration. `modules/product/` owns the detail view, server loader/social metadata adapter, specifications and gallery/share client leaves. `components/` holds reused presentation; `lib/` holds SDK/cache, search parsing and local formatting. Private files stay inside their owning feature. There is no extra presentation package. Catalog locally reproduces Web’s catalog layout, cards, filters, typography, gallery and full-screen viewer. Detail content appears on its own page; account, cart, order navigation and scan controls are absent. Public `cover` is the card/share image; `photos` contains gallery images only, with cover aliases and duplicates removed. Layout is a fixed list, so there is no unused grid/showcase setting.

## Publication and sensitive data

- Global defaults: paused, base=none, empty additions/exclusions, visible prices and status-only stock. Global versions have no drafts; saves apply immediately in CMS and record the server-authenticated editor.
- Selection is `active AND NOT excluded AND (added OR baseMatches)`. Additions bypass criteria, never inactivity/exclusion. Empty filtered criteria means all active products and is disclosed in the panel. Different criteria combine with AND, values within one criterion with OR; tags support any/all.
- Price is `base × (1 + percentage / 100)`, rounded to step 1/100/1000/10000. If that yields zero, use max(1,round(raw)). Invalid/nonpositive base prices remain unpriced. Percentage must be finite and greater than -100. Customer markup never participates. Price filters/sorts use the final amount, invalid prices last. A change over 10 percentage points requires one-use confirmation against the current saved value.
- Stock is the maximum from one active exact warehouse, never a sum. Tile availability needs a full carton; other products need one selling unit. Inquiry sources do not supply exact quantities. Status priority is available, inquiry, unavailable. Hidden publishes nothing; status publishes only status; numeric publishes at most the cap and capped flag, never the real larger quantity.
- Hidden prices/stock also remove dependent controls and reject direct filter/sort attempts. Public DTOs omit base prices, internal percentages, scan codes, full settings and private stock. Missing/invalid settings or infrastructure failures produce service errors, never fake empty success, missing products or unavailability.
- Settings contain only generic contact channels; no store URL or store-specific switch exists. Legacy stored indexing/store-link JSON keys are ignored without rewriting saved versions or applying a destructive migration.

## Rendering, sharing and freshness

Both pages use empty static params, dynamicParams=true and revalidate=300, with Cache Components off. Build requires no CMS connection/key. Page and social metadata share the central cached product read. The interval is an ISR threshold, not a maximum age: expired requests may receive old HTML; failed regeneration preserves the last successful page. This also applies to pause, product removal, prices and visibility. There is no purge/webhook/polling or additional proxy/CDN page cache.

Catalog is permanently noindex through root metadata and X-Robots-Tag. There is no indexing switch, canonical, JSON-LD, Offer or sitemap machinery. OG/Twitter social tags remain in initial HTML: public URL, technical identity and product/share/fallback image precedence. Price, stock and free commercial notes are excluded. Crawlers are not blocked. Copy/Web Share/QR carry the public Catalog URL only.

Search/filter/sort state lives in the URL; server data stays in memory-only TanStack Query. Browse defaults to 24, maximum 100. Persian/Arabic letters/digits, ZWNJ, whitespace and code case normalize; search is empty or at most 100 normalized characters, with escaped SQL wildcards. Cached server pages do not inspect visitor search/cookies/headers. A pre-paint gate prevents default-list flash on filtered links. Back restores URL, loaded pages and approximate scroll; only navigation state is persisted. Policy revisions restart pagination. Images use fixed dimensions/CDN URLs and LCP priority, without runtime optimization or broad prefetch.

## Deployment and verification

Runtime variables are CATALOG_URL, CMS_API_URL and CMS_API_KEY. Compose uses the private CMS address and one non-root standalone Catalog instance with writable ISR cache. Catalog has no WEB_URL. Existing Dokploy routing targets service catalog, port 5176. Configure the existing proxy to apply no-store and IP rate limiting only to `/api/catalog/browse` (initially 10 requests/second, burst 30); trust upstream client IPs explicitly. Public domain routing does not automatically install that middleware. No extra infrastructure service is required.

Run `pnpm test:unit`, `pnpm check-types` and `pnpm build`. Retained unit tests are colocated, deterministic and independent of external services. SDK timers are virtual; coordinator time is fixed. Integration/live/browser/ISR/container automation and its fixtures were deliberately removed by owner decision. Unit/build success does not verify PostgreSQL execution, concurrency, migrations, production connectivity or social-platform behavior. Manual acceptance covers list/search/filter/load-more, back navigation, sharing, RTL layouts, errors/404 and the noindex/social-tag boundary.

Before a server rollout, compare the registered migration names with the target database history and keep a current database backup. The Catalog migration is additive; its initial policy is paused with base=none. A local populated clone rehearsal verified upgrade from the preceding 13-migration schema, repeat execution, and disposable rollback without changing row counts or row digests in the other 40 tables. This does not certify an uninspected server database. Never use migrate:down for operational service rollback: Payload rolls back an entire migration batch, and this migration’s down removes Catalog settings and versions. Roll back application images while retaining the additive schema and saved data. Runtime media in apps/cms/media is excluded from Git and Docker context and supplied through the existing persistent volume.

Shared ACL changes still require separate owner approval with consumer inventory, observed checks and rollback references. Operational rollback must not delete saved settings/versions or silently reopen raw access. No commit, production deployment or shared database action is implied. Production-data preview requires the compatible CMS release and its actual existing service API key; anonymous raw product access is never a fallback.
