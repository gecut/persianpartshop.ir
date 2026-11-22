# 00 — Product purpose, business context and scope

Reviewed: 2026-11-22 (Asia/Tehran). Audience: LLM agents (humans read it through an agent). Business facts come from the product owner's statements on 2026-11-22 and from read-only observation of the **beta** CMS (`admin.beta…`) on the same date; production was not observed. Implementation facts link to code. See [documentation scope](../README.md) for authority rules. Persian terms appear with English meaning.

## 1. What PersianPart is

PersianPart (پرشین پارت) is a wholesale distributor of tiles and ceramics from several factories. It sells to **shop owners and small retailers** (they are the company's *sales representatives*, «نماینده فروش») and plans to sell directly to end consumers.

This system is an **intermediate layer**, not the company's ERP:

| Concern | Owner | This system's job |
| --- | --- | --- |
| Accounting, invoicing, settlement | Kimia accounting software («کیمیای تجارت») | None. Receives its output. |
| Real warehouse management | Company's own warehouse systems | None. Holds a *sellable* balance only. |
| Shipping, delivery | Offline, outside the system | None. `completed` is the last recorded state. |
| Factory stock for `inquiry` warehouses | The factory | None. Staff ask the factory by phone/message. |
| Sales-plan terms and calculations | Company staff | Only **announce** plans to customers. |
| Reserving stock, quoting, recording orders, announcing | This system | **Everything here.** |

**Rule of thumb for agents:** if a feature needs ledger, shipment, factory-stock or discount-calculation knowledge, it does not belong here. Do not add it. *Why:* the owner defined the system as a single narrow mediator; the real systems already exist.

## 2. Two audiences, two applications

| Application | Users | Purpose | Auth |
| --- | --- | --- | --- |
| `apps/web` (PWA) | Sales representatives | 24/7 view of stock, prices, product details, and **reserving stock** (an order without payment is a firm commitment) | SMS OTP, staff-created accounts |
| `apps/catalog` (public) | Designers, architects, engineers, contractors, end consumers | Quickly browse products and retail prices without visiting the physical store | None; CMS decides what is published ([public-catalog](../architecture/public-catalog.md)) |

The web root redirects unauthenticated users to login; this is **not** an API confidentiality guarantee ([access-control](access-control.md)).

## 3. Actors

- **Customer** (`users`): a sales representative. The company puts anyone it stops working with (temporarily or permanently) into a "hold" state («معلق») and stops answering them. Which stored status that maps to (`pending` vs `suspended`) is `[UNKNOWN]` — ask the owner before encoding it ([flows](flows.md) §Customer lifecycle). Observed beta: 8 users, all `active`; 7 are «نماینده نمایشگاه» (exhibition representative), 1 is «مشتری عادی» (regular).
- **Staff** (`admins`): `superadmin`, `manager`, `support`, `service`. `service` is the API's CMS identity and writes orders and customer records.
- **Accountant** (human, outside the system): exports a file from Kimia at the end of each working day, after all orders are closed, and imports it so stock and prices update ([runbook](../operations/runbook.md)).

## 4. Supported scope

- Tile quantities converted to whole cartons; non-tile goods sold in their own primary units.
- One shared price per product and customer-type markup; a separate sellable balance per product per warehouse.
- One warehouse per draft and per order; transactional reservation; immutable order lines.
- Customer cancellation within 60 minutes of order creation; fresh reorder drafts.
- **Supply requests** («درخواست تأمین»): a classic manual workflow for goods not available as exact stock; staff may contact the factory or check other warehouses; no stock is reserved.
- Plans («طرح»): informational announcements of sales offers ([business-rules R11](business-rules.md)).
- Account documents with manual admin approval/rejection.
- Stock/price import from a Kimia-shaped CSV template; other templates may be added.

## 5. Outside scope (do not build without a new owner decision)

Pooled stock, split fulfillment, multi-warehouse orders, backorder, warehouse transfer, shared server cart, order item editing, reopening cancelled orders, payment gateway, carrier integration, discount/credit calculation, persistent `ImportRun` approval engine, automatic reversal of a completed import. A Kimia API integration is **possible in the future** (the owner may pick a new accounting product with an API); today the import is a CSV template only.

## 6. Beta data snapshot (2026-11-22, not production)

| Fact | Observed |
| --- | --- |
| Warehouses | 2: `mashhad` «انبار مشهد» (`exact`), `factory` «انبار کارخانه» (`inquiry`); both active |
| Customer types | `regular` «مشتری عادی», `exhibition-representative` «نماینده نمایشگاه»; `markupPercent` 0 for both |
| Categories | 4: کاشی و سرامیک, اسلب, قرنیز, چسب و ملات |
| Brands | «پرسپولیس یزد», «سارا کاشی سپاهان» |
| Products / families / dimensions | 668 / 30 / 26 |
| Plans | 0 |
| Orders | 4: `completed` 1, `cancelled_by_customer` 2, `pending` 1 |
| Supply requests | 3, all `supplied` (two use the test product `TEST-SUPPLY-REQUEST`) |
| SMS queue | 10: 8 `sent`, 2 `failed` (provider error «ساختار کد صحیح نمی باشد» for order 5) |

Because markup is 0 for both types and there are no plans, the tier-markup and plan paths are implemented but **unexercised in beta data**. Treat their behavior as code-verified only.

Sources: [root contract](../../packages/contract/src/index.ts), [CMS configuration](../../apps/cms/src/payload.config.ts), [API routers](../../apps/api/src/routers/index.ts), [web root](../../apps/web/src/routes/__root.tsx), [warehouse decisions](business-rules.md).
