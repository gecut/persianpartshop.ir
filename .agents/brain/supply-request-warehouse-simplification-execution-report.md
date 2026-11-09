# گزارش نهایی اجرای ساده‌سازی فرآیند تأمین و انبارداری (استاندارد Nexload v2)

> **تاریخ**: ۲۰۲۶-۱۱-۰۹ (۱۹ آبان ۱۴۰۵)  
> **سند پلن مرجع**: [`.agents/brain/supply-request-warehouse-simplification-plan.md`](file:///Users/mm25zamanian/Codes/persianpartshop.ir/.agents/brain/supply-request-warehouse-simplification-plan.md)  
> **مبنای کامیت**: [`11693c0`](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/migrations/index.ts#L1-L10)  
> **استانداردهای مهندسی**: `nexload-reasoning-execution`، `nexload-code`، `nexload-react`، `nexload-design`، `rtl-persian-ui`، `orpc` و `payload`.

---

## ۱. خلاصه اجرایی (Executive Summary)

طرح جامع ساده‌سازی فرآیند تأمین و انبارداری با هدف حذف دوگانگی مفاهیم انبار قطعی و منبع تأمین، انتزاع انتخاب انبار از مشتری در درخواست‌های تأمین، یکپارچه‌سازی تجربه کاربری کاتالوگ بر اساس متراژ درخواستی، و ادغام تاریخچه سفارشات به فید یکپارچه فعالیت‌ها با موفقیت کامل در هر ۴ فاز پیاده‌سازی و روی پایگاه‌داده لوکال موجود اعمال شد.

### دستاوردهای کلیدی:
1. **ادغام مدل‌های داده**: جدول و کالکشن فعال `supply_sources` حذف و مفهوم انبار استعلامی با `inventory_sqm = NULL` در جدول واحد [`warehouse_stock`](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/collections/warehouse-stock/warehouse-stock.collection.ts#L8-L45) تجمیع شد. سوابق قبلی با نگاشت دقیق در `_migration_supply_sources_mapping` به `supply_sources_legacy` منتقل گردید.
2. **انتزاع انبار در درخواست تأمین (v2)**: مشتری بدون نیاز به انتخاب انبار، متراژ مورد نیاز خود را ثبت می‌کند. سیستم با موتور بازپخش دوگانه، هم درخواست‌های نسخه ۱ (شامل انبار) و هم نسخه ۲ (بدون انبار) را پشتیبانی می‌کند.
3. **فلو متراژمحور در فرانت‌اند**: تب‌های جداگانه کاتالوگ حذف و مودال هوشمند تعیین متراژ جایگزین شد (کفایت موجودی قطعی $\rightarrow$ سفارش قطعی؛ کسری متراژ + استعلام فعال $\rightarrow$ درخواست تأمین برای کل متراژ).
4. **فید یکپارچه فعالیت‌ها (`/orders`)**: جایگزینی تب‌های دوگانه با فید مشترک شامل کارت‌های پلی‌مورفیک سازگار با RTL و صفحه‌بندی امن متقارن بر مبنای کرسر و واترمارک زمانی.
5. **اعمال روی پایگاه داده قبلی بدون از دست رفتن دیتا**: اسکیما و مایگریشن‌های سیستم روی پایگاه‌داده لوکال قبلی (`persianpart_cms`) اعمال شد و تمام ۲۶ محصول، ۷ دسته‌بندی، ۳ کاربر، ۵ سفارش و ۵۲ رکورد موجودی انبار با سلامت کامل حفظ شدند.

---

## ۲. جزئیات تغییرات فنی به‌تفکیک لایه‌ها

### ۲.۱ پکیج قراردادها (`packages/contract`)
- [**`packages/contract/src/activity-feed.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/packages/contract/src/activity-feed.ts):
  - تعریف اسکیمای SSOT برای فید مشترک با `ActivityFeedItem` (اتحاد تفکیک‌پذیر `order` و `supply`).
  - تعریف فیلترهای سه‌حالته (`all`, `order`, `supply`) و اسکیمای کرسر جهت صفحه‌بندی بدون پرش.
- [**`packages/contract/src/supply-request.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/packages/contract/src/supply-request.ts):
  - اختیاری‌سازی فیلد `warehouseId` در ورودی متد `submit` جهت پشتیبانی از بازپخش درخواست‌های کلاینت‌های کش‌شده نسخه ۱.
  - نال‌پذیر شدن فیلدهای انبار در اسکیمای `SupplyRequestSchema`.
  - حذف آرایه انبارهای استعلامی از خروجی متد `preview`.
- [**`packages/contract/src/index.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/packages/contract/src/index.ts):
  - ثبت قرارداد `activityFeed` در روتر ریشه قراردادها.

---

### ۲.۲ سرویس و پایگاه‌داده CMS (`apps/cms`)
- [**`apps/cms/src/migrations/20261108_210000_supply_simplification.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/migrations/20261108_210000_supply_simplification.ts):
  - بررسی پیش‌شرط عدم وجود رکوردهای یتیم در `supply_sources` و عدم برخورد کلیدهای ترکیبی `(warehouse_id, product_id)`.
  - نال‌پذیر کردن `inventory_sqm` و به‌روزرسانی قید `warehouse_stock_amount_check`.
  - افزودن ستون‌های `is_active` و `last_reported_at` به `warehouse_stock`.
  - کپی امن ردیف‌های منبع تأمین به `warehouse_stock` با حفظ نگاشت در جدول `_migration_supply_sources_mapping`.
  - تغییر نام امن جدول قبلی به `supply_sources_legacy`.
  - نال‌پذیر کردن فیلدهای انبار در `supply_requests` و افزودن `fingerprint_version`.
  - همگام‌سازی توالی کلید اصلی انبار با استفاده از تابع استاندارد `pg_get_serial_sequence`.
- [**`apps/cms/src/collections/warehouses/warehouses.collection.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/collections/warehouses/warehouses.collection.ts#L44):
  - اصلاح کوئری هوک `beforeChange` به جدول `supply_sources_legacy` جهت جلوگیری از کراش در ویرایش انبارها.
- [**`apps/cms/src/collections/warehouse-stock/warehouse-stock.collection.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/collections/warehouse-stock/warehouse-stock.collection.ts):
  - ادغام کامل انبار استعلامی؛ پشتیبانی فیلد مجازی `stockCartons` از حالت‌های نال؛ اعتبارسنجی نوع انبار در هوک تغییرات.
- [**`apps/cms/src/collections/supply-requests/supply-requests.collection.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/collections/supply-requests/supply-requests.collection.ts):
  - پشتیبانی از نسخه ۲ بدون انتساب انبار؛ افزودن فیلد مخفی `fingerprintVersion`.
- [**`apps/cms/src/endpoints/activity-feed.endpoint.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/endpoints/activity-feed.endpoint.ts):
  - پیاده‌سازی اندپوینت داخلی امن با کوئری CTE ترکیبی `UNION ALL`، اعمال تاپل صریح جهت‌دار `(created_at, kind, id)`، اعمال واترمارک زمانی، متد `limit + 1` برای تعیین بی‌هزینه `hasMore` و هیدراتاسیون موازی اسناد از طریق Local API.
- [**`apps/cms/src/payload.config.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/payload.config.ts):
  - حذف `SupplySources` از لیست کالکشن‌های فعال و ثبت اندپوینت `/api/activity-feed`.
- [**`apps/cms/src/_schema-inspect.test.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/src/_schema-inspect.test.ts):
  - اجرای زنجیره‌ای مایگریشن ۱ و ۲، آزمون کوئری‌های CTE اندپوینت، بررسی یکپارچگی ارجاعات و تست تمیز بازگشت (Rollback).

---

### ۲.۳ لایه API و روترها (`apps/api`)
- [**`apps/api/src/routers/activity-feed.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/api/src/routers/activity-feed.ts):
  - پیاده‌سازی کنترلر oRPC برای دریافت درخواست فید، استخراج هویت کاربر از session و فراخوانی ایمن اندپوینت CMS.
- [**`apps/api/src/routers/activity-feed.test.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/api/src/routers/activity-feed.test.ts):
  - تست‌های یونیت برای حالت کاربر فعال، رد دسترسی کاربران مهمان و غیرفعال، و مدیریت خطای بالادستی.
- [**`apps/api/src/routers/supply-request.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/api/src/routers/supply-request.ts):
  - به‌روزرسانی پیش‌نمایش جهت خواندن منابع استعلامی فعال از `warehouse_stock`.
  - پیاده‌سازی موتور بازپخش دوگانه (اثر انگشت نسخه ۱ با انبار، اثر انگشت نسخه ۲ بدون انبار).
- [**`apps/api/src/routers/warehouse-stock.helpers.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/api/src/routers/warehouse-stock.helpers.ts):
  - یکپارچه‌سازی متدهای کمکی جستجوی موجودی قطعی و رابطه استعلامی.

---

### ۲.۴ رابط کاربری کلاینت وب (`apps/web`)
- [**`apps/web/src/routes/product/index.tsx`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/src/routes/product/index.tsx):
  - حذف سوئیچ دوحالته «خرید از موجودی» / «درخواست تأمین» در بالای صفحه کاتالوگ.
- [**`apps/web/src/features/products/product-card.tsx`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/src/features/products/product-card.tsx):
  - نشان‌های سه‌حالته («موجود»، «قابل استعلام»، «ناموجود»)؛ رفع باگ دسترسی خرید برای کاربران با `hideExactStock: true`.
- [**`apps/web/src/features/products/product-quantity-modal.tsx`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/src/features/products/product-quantity-modal.tsx):
  - مودال تعیین متراژ با اعتبارسنجی زنده؛ سوئیچ خودکار بین «افزودن به سبد سفارش» و «ثبت درخواست تأمین برای کل متراژ»؛ همگام‌سازی استیت در جابجایی بین محصولات.
- [**`apps/web/src/features/supply-requests/supply-request-modal.tsx`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/src/features/supply-requests/supply-request-modal.tsx):
  - حذف منوی انتخاب انبار از فرم کلاینت.
- [**`apps/web/src/features/supply-requests/use-supply-submission.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/src/features/supply-requests/use-supply-submission.ts):
  - برداشته شدن شرط الزامی بودن انبار در متد `submit`؛ تصحیح کلید ابطال کش به `queryKeys.activityFeed.all`.
- [**`apps/web/src/routes/orders/index.tsx`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/src/routes/orders/index.tsx):
  - ادغام تب‌ها به صفحه واحد «درخواست‌ها و سفارش‌ها» با فیلتر سه‌حالته و کارت‌های پلی‌مورفیک سازگار با RTL؛ حفظ پشتیبانی از لینک‌های پیامکی قدیمی (`?view=supply&requestId=...`).
- [**`apps/web/e2e/pwa-supply.spec.ts`**](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/web/e2e/pwa-supply.spec.ts):
  - تطبیق کامل آزمون‌های مرورگر Playwright با فلو مبتنی بر متراژ و فید مشترک.

---

## ۳. عملیات پایگاه داده لوکال و مهاجرت داده‌ها (Database Reconciliation)

1. **پشتیبان‌گیری پیشگیرانه**:
   - فایل پشتیبان [`apps/cms/backup_persianpart_cms_pre_migration.sql`](file:///Users/mm25zamanian/Codes/persianpartshop.ir/apps/cms/backup_persianpart_cms_pre_migration.sql) با استفاده از `pg_dump` رسمی PostgreSQL 17 ایجاد شد (حجم: ۱۲۷ کیلوبایت).
2. **اعمال دلتای اسکیما روی دیتابیس قبلی**:
   - اسکریپت دلتا به صورت تراکنشی روی پایگاه‌داده `persianpart_cms` اجرا شد.
   - وضعیت مایگریشن‌ها در جدول `payload_migrations` ثبت شد:
     - `20261108_152041_baseline` (Batch 3)
     - `20261108_210000_supply_simplification` (Batch 3)
3. **تأیید وضعیت مایگریشن در Payload**:
   - اجرای `pnpm --filter @persianpart/cms migrate:status` وضعیت هر دو مایگریشن را به عنوان **Ran: Yes** تایید کرد.
4. **تأیید سلامت و تعداد رکوردهای پایگاه داده**:
   - محصولات: ۲۶ رکورد
   - انبارها: ۲ رکورد
   - موجودی انبار: ۵۲ رکورد
   - کاربران: ۳ رکورد
   - سفارش‌ها: ۵ رکورد
   - درخواست‌های تأمین: ۰ رکورد (آماده ثبت نسخه ۲)

---

## ۴. ماتریس راستی‌آزمایی تجربی (Claim-Matched Verification)

| حیطه آزمون | فرمان اجرایی | خروجی مشاهده‌شده |
| :--- | :--- | :--- |
| **تایپ‌چک قراردادها** | `pnpm --filter @persianpart/contract exec tsc --noEmit` | **PASS** (بدون خطا) |
| **تایپ‌چک API** | `pnpm --filter @persianpart/api exec tsc --noEmit` | **PASS** (بدون خطا) |
| **تایپ‌چک Web** | `pnpm --filter @persianpart/web exec tsc --noEmit` | **PASS** (بدون خطا) |
| **تست‌های یونیت API** | `pnpm --filter @persianpart/api test` | **PASS** (۲۲ پاس، ۵ لایو اسکیپ، ۰ خطا) |
| **تست‌های هاردنینگ CMS** | `pnpm --filter @persianpart/cms test:hardening` | **PASS** (۷۷ از ۷۷ تست پاس شد) |
| **تست ارتقا و بازگشت دیتابیس** | `pnpm --filter @persianpart/cms test:hardening:migrations` | **PASS** (تست موفق UP و DOWN و کوئری‌های CTE) |
| **بیلد نهایی پروداکشن وب** | `pnpm --filter @persianpart/web build` | **PASS** (کامپایل ۱۱,۲۴۷ ماژول و ساخت PWA Service Worker) |
| **تست‌های مرورگر Playwright** | `pnpm --filter @persianpart/web exec playwright test` | **PASS** (۱۹ از ۱۹ تست مرورگر در تمام فایل‌های spec پاس شدند) |

---

## ۵. وضعیت سرویس‌های فعال در محیط توسعه (Dev Servers Status)

تمامی سرویس‌ها با استفاده از `run_command` در پس‌زمینه (Daemon) اجرا شده و سلامت آن‌ها با کدهای پاسخ HTTP تأیید شد:

| نام سرویس | رانتایم و پورت | آدرس دسترسی | کد پاسخ تست سلامت |
| :--- | :--- | :--- | :--- |
| **Web SPA** | React 19 + Vite 8 (`:5173`) | [http://localhost:5173](http://localhost:5173) | `200 OK` |
| **Payload CMS** | Next.js Turbopack (`:5174`) | [http://localhost:5174/admin](http://localhost:5174/admin) | `200 OK` |
| **Backend API** | Hono + oRPC on Bun (`:5175`) | [http://localhost:5175/health](http://localhost:5175/health) | `200 OK` |
