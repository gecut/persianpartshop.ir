# 00 — Product scope and current behavior

Reviewed: 2026-11-07 (Asia/Tehran). This is an implementation-grounded description; see [documentation scope](README.md) for authority and historical records.

## Product

PersianPart is a B2B ordering platform for tiles, ceramics, slabs and related non-tile supplies. Customers have staff-managed accounts and customer-tier prices. The web application is Persian, RTL and mobile-first. Settlement and dispatch are handled offline; payment verification is not a payment gateway.

The commercial intent is an authenticated trade portal. The web root redirects unauthenticated users to login, but this is **not an API confidentiality guarantee**: catalog procedures use the public `base` implementer and the CMS products collection has public read access. See [access boundaries](04-roles-and-permissions.md).

## Actors

- Customer: a `users` record, authenticated by SMS OTP; account status, ban flags, category access and ordering flags constrain behavior.
- Manager (`manager`) and supervisor (`superadmin`): human CMS accounts in `admins`.
- Service (`service`): CMS API-key identity used by the API. It can write orders and customer records; it is not globally read-only. Warehouse balance administration and CSV application are restricted to manager/superadmin.

`support` is a selectable staff role for sales operations and supply-request statuses. `editor` remains a legacy helper role and is not selectable in the admin schema.

## Supported scope

- Tile carton conversion; non-tile sales in their own primary units, with secondary units/weight as descriptive metadata.
- Shared product price and tier markup across warehouses; separate sellable balances per product/warehouse.
- One warehouse per browser draft and per order; explicit warehouse selection when several can fulfill the whole cart.
- Server-authoritative prices, transactional reservation, immutable order lines, customer cancellation within 60 minutes and fresh reorder drafts.
- Customer profiles, addresses, documents, category restrictions and catalog-only accounts.
- Assigned plans with content, optional products, activation/start/expiry and personalized display. Plans do not automatically change order prices.
- Separate price CSV and warehouse stock CSV, with signed preview/application for stock.
- Staff activity logs and order status timelines, with the actual coverage and access described in document 04.

## Outside current scope

No pooled stock, split fulfillment, multi-warehouse order, backorder or warehouse transfer. No shared server cart across devices. No order item editing or reopening cancelled orders. Empty custom orders are disabled. No online payment settlement or carrier integration. No implemented persistent `ImportRun` approval engine, anomaly-scoring pipeline or automatic reversal of a completed CSV import.

## Ownership

CMS owns product prices, inventory and order lifecycle. The API implements `packages/contract` and accesses CMS through its REST SDK. The web renders previews and stores account-scoped drafts; it does not create successful local-only orders. Each SKU is an independent product.

Sources: [root contract](../packages/contract/src/index.ts), [CMS configuration](../apps/cms/src/payload.config.ts), [API routers](../apps/api/src/routers/index.ts), [web root](../apps/web/src/routes/__root.tsx), [warehouse decisions](07-warehouses.md).
