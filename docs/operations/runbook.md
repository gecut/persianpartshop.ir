# 06 — Administration and verification runbook

Human operators include manager, superadmin and support; consult [permissions](../product/access-control.md) for exact boundaries.

## Accounts and catalog

Create a customer with full name, unique phone, tier and account status. Company/address/identity and documents can be completed as needed; do not describe every optional address field as a schema requirement. OTP requires `status=active`; pending/suspended/banned customers cannot use normal sign-in. Account flags do not automatically cancel existing orders.

Use allowed categories for catalog restrictions. `hideExactStock` also disables ordering; `disableOrdering` can independently disable it. Review uploaded document status separately; document review does not substitute for reading the actual account status.

Create tile and other products with SKU/name/slug and the appropriate metadata. A tile must have a valid carton factor to be ordered. Other uses its primary unit; secondary weight/content is descriptive. Existing stock records prevent changing product type/primary unit. Packaging changes with open orders or new/reviewing supply requests are rejected with a tracking reference. There is no implemented general catalog-completeness scoring service.

## Price and stock CSV

Choose stock, price, or Kimia processing. Stock CSV uses `sku,inventorySqm`; price CSV uses `sku,basePricePerSqm` in whole Tomans. Kimia exports are headerless semicolon-delimited Windows-1256 or UTF-8 with unit, price in Rials, sellable stock, name, SKU and an empty trailing column. The system rounds converted prices to the nearest Toman; names and units are ignored.

Select an active warehouse for stock and Kimia. File stock is the reconciled sellable quantity after reservations; rows absent from the file remain unchanged unless the opt-in «کالاهای خارج از فایل در این انبار صفر شوند» (`zeroMissing`, default off) is checked, in which case positive balances of the chosen exact warehouse whose SKU does not appear in the file are shown in the preview as «خارج از فایل» and zeroed under the same signed apply transaction. Files are limited to 1 MB and 1,000 rows (up to 2,000 total snapshot rows with `zeroMissing`). Invalid, duplicate, and unknown SKU rows are shown and skipped (their SKUs still count as present for `zeroMissing`); valid rows are applied together only after confirmation. A stale preview is rejected. Price is global, while stock is warehouse-specific. Price export pages contain up to 1,000 rows and are suitable for reimport.

Below the upload box, the «موجودی انبارها» board shows one row per product and one column per active warehouse, with search (name/SKU), category, brand, and stock-status filters plus pagination (25/50/100). Exact-warehouse cells support inline numeric editing (saved sequentially with per-cell revision checks against the revision the edit started from, and individual audit logs; a rejected cell is reset to the current value and must be re-entered). Inquiry-warehouse cells provide a «قابل استعلام» checkbox (saved in batches of up to 500 per inquiry warehouse; each batch that changes rows writes one audit log) and page-level bulk tick/untick buttons. Direct balance amount/revision changes, balance deletion and warehouse deletion are blocked. Managers may edit balance activity/report metadata; product and warehouse identity are fixed. Completed imports have no automatic undo; use a fresh reconciled file for correction.

## Orders and plans

Create an inquiry warehouse and tick the «قابل استعلام» checkbox for each product on the «موجودی انبارها» board. Staff explicitly move requests into review or a final result; merely opening a record does not start review. A result transition attempts an SMS using the explicitly configured `KAVENEGAR_API_KEY` and `WEB_URL`; missing configuration or provider failure does not roll back the status. Delivery is best effort: notifications are attempted only after the owning transaction commits and have no retry queue. A process failure between commit and delivery can lose a notification.

Orders arrive as `pending` with warehouse and immutable authoritative line amounts. Staff can approve (`approve`), complete, or cancel within the allowed transitions. Print the warehouse name and original quantities; no picking across warehouses. Customers can cancel pending orders within 60 minutes; staff can cancel pending/approved orders before completion. Cancelled/completed orders cannot reopen. No required structured staff-reason field or multi-stage preparing/ready workflow is implemented.

Plans require title/content and assigned users, with optional product references and start/expiry. Activate the plan and review derived display status. Plan terms are text, not automatically applied financing math. Adding recipients may send notifications; disable notification SMS in seed/test environments.

## Local commands

Run from repository root using pnpm:

```bash
pnpm install
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm --filter @persianpart/api typecheck
pnpm --filter @persianpart/web build
pnpm --filter @persianpart/cms exec tsc --noEmit --incremental false
pnpm --filter @persianpart/cms build
pnpm --filter @persianpart/cms test:unit
pnpm --filter @persianpart/api test
```

Root `dev` currently calls itself; use workspace commands when dev is requested. CMS/API/Web default to 5174/5175/5173. Do not manually edit generated route tree, Payload types or import map. Web catalog unit tests use Bun via `pnpm --filter @persianpart/web test:unit`.



## Migration, seed and deployment

CMS has one re-created baseline covering supply requests and support roles. It initializes an empty database and must not be applied over existing tables. Databases with prior migration history require a separately planned data-preserving transition or an explicitly authorized reset; this baseline does not perform either automatically.

Seed requires `NODE_ENV=development` and `CMS_SEED_DATABASE_URI` exactly matching the effective local database URI with a guarded name. On a fresh target it creates 26 tile products, two other products, two exact warehouses with 56 balances, one inquiry warehouse with three supply sources, one supply request, three customers and five demo orders. A sample tile has a 48-carton pallet factor. Existing balances and the sample request are preserved on rerun; seed is not a reset command. Use `DISABLE_SMS=true` for CMS notifications.

The historical [verification record](../../.agents/brain/warehouse-merge-completion-2026-11-07.md) describes earlier migrations and is not a statement about a future environment.

New administrator accounts default to `superadmin`; explicitly selected manager, support and service roles remain available. Creating an administrator with a valid phone also creates or updates its customer account in the same transaction. On a fresh database, the first such account creates a zero-markup regular customer tier instead of assuming a fixed relationship ID.

## اتصال کلاینت‌های هوش مصنوعی (Codex / Antigravity) به CMS

1. image جدید CMS را همراه با migration سرویس Compose منتشر کنید. `CMS_MCP_ENABLED=false` پیش‌فرض است. پس از smoke test پنل و REST، پرچم را در محیط CMS روی `true` بگذارید و CMS را دوباره اجرا کنید. برای MCP از PostgreSQL استفاده کنید.
2. در هر محیط یک حساب مجزای فعال با نقش `manager` بسازید. با حساب `superadmin` در **MCP → API Keys**، این حساب را مالک انتخاب کنید، تولید کلید را فعال کنید و قابلیت‌ها را متناسب با کار مشخص کنید. برای بررسی اولیهٔ محیط اصلی فقط جست‌وجوی محصول را فعال کنید.
3. نمونهٔ تنظیمات Codex یا Antigravity (فایل‌های نمونه در مخزن نیست `[UNKNOWN]`) را در تنظیمات محلی کلاینت قرار دهید و URL را با دامنهٔ محیط جایگزین کنید. متغیر `PERSIANPART_CMS_MCP_TOKEN` یا توکن هدر `Authorization` را از محل نگهداری محرمانه تأمین کنید. کلاینت‌ها برای دریافت رویدادها و پاسخ‌ها باید هدر `Accept: application/json, text/event-stream` را ارسال کنند. یک جست‌وجوی محصول (`findProducts`) اجرا کنید تا اتصال و مجوز واقعی بررسی شود.
4. پیش از فعال‌کردن دسترسی نوشتن محیط اصلی، گردش‌کارهای محیط آزمایشی را اجرا کنید. در نشست تعاملی، تنظیمات تأیید باید پنجرهٔ انسانی را برای ابزارهای نشانه‌گذاری‌شده نشان دهند. پیش از فراخوانی، از عامل هوشمند بخواهید شناسهٔ هدف و اثر عملیات، و برای CSV شناسه و خلاصهٔ پیش‌نمایش، را نمایش دهد. این پنجره در کلاینت اعمال می‌شود. سایر کلاینت‌ها با مجوزهای CMS کار می‌کنند.

### الزامات و استانداردهای کاتالوگ برای عامل‌های هوشمند (LLM / MCP Agents)

کلیه عامل‌های هوشمند متصل به CMS که ابزارهای نوشتاری نظیر `createProducts`، `updateProducts` و `applyCsvImport` را اجرا می‌کنند، ملزم به رعایت ۱۰۰٪ استانداردهای تفصیلی در **[11 — استاندارد ساخت و نام‌گذاری محصولات (LLM-Only Standard)](../standards/catalog-product-standard.md)** هستند:

1. **فرمول سه‌بخشی نام‌گذاری کالا:**
   $$\mathbf{Name} = \text{[نام طرح]} + \text{[رنگ]} + \text{[نوع لعاب]}$$
   (مانند `مالاگا صدفی مات پرسلان`، `ولورا کرم روشن مات پانچ پرسلان`، `مونزا بژ روشن پولیش`، `پارلا صدفی روشن`).
2. **قواعد منفی و استثنای انحصاری اسلب:**
   - **قاعده واژه «پرسلان»:** پرسلان جنس بدنه است و نباید در نام کالاهای عادی درج شود. **استثنای انحصاری و الزامی اسلب‌ها (شناسه ۳):** اسلب‌های مات ساده الزماً با عنوان **«مات پرسلان»** و اسلب‌های پانچ الزماً با عنوان **«مات پانچ پرسلان»** نام‌گذاری می‌شوند. در سایر دسته‌بندی‌ها (کاشی و سرامیک، قرنیز) درج کلمه پرسلان اکیداً ممنوع است.
   - **حذف نام دسته‌بندی از عنوان:** درج کلمات `اسلب`، `قرنیز`، `کاشی` و `سرامیک` در عنوان کالا ممنوع است (تعلق کالا از طریق رابطه `category` در دیتابیس تعیین می‌شود).
   - **حذف قطعی حرف W:** کاراکتر لاتین `W` باید کاملاً از تمامی عناوین حذف شود.
   - **عدم درج درجه کیفی در عنوان:** درجه کیفی منحصراً در فیلد `grade` ثبت می‌شود.
3. **تفکیک ابعاد و دسته‌بندی اسلب (Slab):**
   - فقط کالاهایی با ابعاد دقیق **۱۲۰×۲۸۰ سانتی‌متر** (شناسه بُعد ۱۱ / `۲۸۰×۱۲۰`) مجاز به قرارگیری در دسته اسلب (شناسه ۳) هستند. سایر ابعاد (نظیر ۱۶۰×۸۰) باید به دسته «کاشی و سرامیک» (شناسه ۱) منتقل شوند.
   - لعاب مات ساده اسلب الزماً **«مات پرسلان»** و لعاب پانچ اسلب الزماً **«مات پانچ پرسلان»** است.
   - برای اسلب‌های درجه ۴، فیلد `grade` باید به **`grade_d`** تنظیم شود.
4. **الزام همگام‌سازی فیلد رنگ (`products.color`):**
   - فیلد `color` در موجودیت کالا باید دقیقاً مطابق با رنگ استخراج‌شده از عنوان کالا مقداردهی شود و نباید خالی رها شود.
5. **اعتبارسنجی متادیتا و بسته‌بندی:**
   - فیلد `piecesPerCarton` نباید `null` باشد (حداقل مقدار مجاز: `1`).

برای فایل محلی، ابتدا `prepareMediaUpload` یا `prepareCsvImport` را صدا بزنید. فایل را در فیلد `file` با بلیت موقت در هدر بفرستید. فرمان نمونه صرفاً برای همان دامنهٔ CMS و فایل انتخاب‌شده است.

```sh
curl --fail-with-body --request POST \
  --header "X-MCP-Upload-Ticket: ${UPLOAD_TICKET}" \
  --form "file=@${LOCAL_FILE}" \
  "https://admin.persianpart.shop/api/mcp-upload"
```

بلیت پنج دقیقه اعتبار دارد و یک بار مصرف می‌شود. عکس تا ۵ MiB و ۴۰ مگاپیکسل و CSV با UTF-8 تا ۱ MB پذیرفته می‌شود. شناسهٔ عکس را در فیلد تصویر محصول قرار دهید. برای CSV، `previewId` را با `getCsvImportPreview` بررسی کنید و پیش‌نمایش بدون خطا را بعد از تأیید با `applyCsvImport` اعمال کنید. پیش‌نمایش کهنه یا مصرف‌شده باید دوباره تهیه شود. پراکسی باید هر دو مسیر را روی HTTPS با عبور هدرها عرضه کند و برای عکس حداقل ۶ MiB ظرفیت بدنه داشته باشد.

برای آزمون محلی، migration را روی دیتابیس دورریختنی `persianpart_mcp` روی loopback اجرا کنید. CMS را روی loopback با `CMS_MCP_ENABLED=true` و `DISABLE_SMS=true` بالا بیاورید و با همان `DATABASE_URL` و `PAYLOAD_SECRET` و با تنظیم `CMS_MCP_TEST_URL`، دستور `pnpm --filter @persianpart/cms test:mcp:postgres` را اجرا کنید. `CMS_MCP_TEST_CODEX=true` اتصال و اجرای یک ابزار خواندنی با Codex CLI را هم بررسی می‌کند.

برای بازگشت، کلید را از پنل غیرفعال یا حذف کنید و `CMS_MCP_ENABLED=false` را اعمال کنید. داده‌های migration در دیتابیس باقی می‌مانند و عملیات از REST ادامه پیدا می‌کند. برای چرخش کلید، ابتدا کلید جایگزین را در Codex بررسی کنید و سپس کلید قدیمی را لغو کنید.

Automated verification now retains only isolated, colocated unit tests across all workspaces (`pnpm test:unit`), plus typechecks/builds. Live/database/browser/container suites and their fixtures were removed by owner decision; manual runtime acceptance is separate.


## Warehouse stock import details (from the former warehouse decision record)

- Page «موجودی انبارها»: upload box on top (choose one active exact warehouse → upload or paste CSV → optionally enable «کالاهای خارج از فایل در این انبار صفر شوند» / `zeroMissing` → request preview → confirm) above the products × active-warehouses board (filters, inline numeric edits, «قابل استعلام» checkboxes with page-level bulk tick/untick, and pager).
- Limits: 1–1,000 file rows (up to 2,000 total snapshot rows with `zeroMissing`), ≤ 1 MB. Unknown/duplicate SKUs, more than two decimals, and negative values are rejected per row; any SKU present in the file (including invalid or duplicate rows) is excluded from `zeroMissing`, which only zeroes positive balances of the chosen exact warehouse and shows them as «خارج از فایل».
- The file number is the **sellable balance after reservations**. The system cannot know when the physical count happened, so the file must be fresh. Absent rows are unchanged unless `zeroMissing` is enabled.
- Preview has no side effects, is valid for 15 minutes, and is signed over user, warehouse, data, each balance revision and product update time. Any balance change between preview and apply rejects the whole transaction. A successful apply writes its audit log in the same transaction.
- Endpoints (manager session): `POST /api/warehouse-stock/preview`, `POST /api/warehouse-stock/apply`, `GET /api/warehouse-stock/board`, `POST /api/warehouse-stock/inquiry` (batch inquiry toggles; one audit log per batch that changes rows), and `POST /api/warehouse-stock/for-product/:productId` (per-cell revision-checked numeric edit with individual audit log). Price import is separate and rejects a stock column.
- Managers and superadmins administer warehouses and stock; the `service` identity can read stock and run existing order operations but cannot import or edit stock. Deleting a warehouse or balance is not allowed (deactivate instead).
- Rollout: deploy CMS, API and Web together on the new contract. A baseline migration exists for an empty database only. Seed is allowed only against a guarded local target and does not reset existing balances.
- QR token labels two-release rollout:
  - **Release 1:** deploy code + expand migration (`20261125_120000_qr_codes` adding `qr_codes` while retaining legacy `products.scan_code`). Take a database backup first, rehearse the migration on a clone, and never use `migrate:down` for operational rollback.
  - **Release 2:** deploy the contract migration to drop `products.scan_code` only after every container is running Release 1.
- Automated checks today are isolated unit tests (`pnpm test:unit`). Concurrency, transactions and live authorization have no automated fixtures and need manual verification; set `DISABLE_SMS=true` while testing.
