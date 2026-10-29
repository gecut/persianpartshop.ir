# پلن جامع سازگاری کامل پروژه با Shared Volume و Nginx CDN

> **شناسه پلن**: `1793216260147-shared-volume-nginx-cdn-plan`  
> **هدف**: یکپارچه‌سازی ذخیره‌سازی تصاویر در Shared Volume (`persianpart_media_data`) و سرو مستقیم آن‌ها از Nginx CDN مستقل (`ghcr.io/gecut/nginx/cdn:2.0.0`) به‌طوری که تمام مصرف‌کنندگان (CMS، API، Web و Storeها) تصاویر رسانه را مستقیماً از دامنه CDN دریافت کنند.

---

## ۱. وضعیت فعلی و معماری داده

1. **Volume مشترک و ساختار فایل**:
   - در `docker-compose.yml:78-80` سرویس CMS پوشه `/app/apps/cms/media` را روی Volume `persianpart_media_data` سوار کرده است.
   - در `apps/cms/src/collections/media/media.collection.ts:31-49` تنظیم `staticDir: 'media'` باعث ذخیره مستقیم فایل‌های وب‌پ‌شده در ریشه این Volume می‌شود (`<filename>.webp`).
   - سرویس CDN در `docker-compose.yml:121-131` همین Volume را روی `/data:ro` می‌خواند. چون Document Root ایمیج `ghcr.io/gecut/nginx/cdn` برابر `/data` است، فایل‌ها مستقیماً با نشانی `https://<CDN_DOMAIN>/<filename>` در دسترس هستند.
2. **نقاط ناهماهنگ فعلی**:
   - `apps/cms/src/collections/media/media.collection.ts`: پیش‌فرض Payload نشانی فایل‌ها را به‌صورت `/api/media/file/<filename>` روی دامنه CMS تولید می‌کند.
   - `apps/api/src/server.ts:91-130`: اندپوینت مستقیم `/api/media/upload` فایل را روی دیسک می‌نویسد اما رکورد در Payload Media ایجاد نمی‌کند.
   - `apps/api/src/routers/catalog.helpers.ts:11`: فال‌بک نشانی تصاویر را به `/api/media/file/<filename>` متصل می‌کند.
   - `apps/web/src/features/products/product-store.ts:13-31` و `apps/web/src/features/orders/order-store.ts:201-204`: منطق‌های دستی و پراکنده برای ساخت آدرس نسبی `/api/media/file/...` دارند که در مرورگر به دامنه کلاینت وب ارسال می‌شود.

---

## ۲. مشخصات و تصمیمات فنی (SSOT)

| بعد | تصمیم تثبیت‌شده |
| :--- | :--- |
| **ایمیج و سرویس CDN** | حفظ ایمیج فعلی `ghcr.io/gecut/nginx/cdn:2.0.0` روی پورت ۸۰ کانتینر با خواندن از `/data:ro` |
| **قرارداد نشانی CDN** | متغیر محیطی `CDN_URL` (مثلاً `https://cdn.persianpart.shop` در سرور و `http://localhost:8080` در توسعه محلی) |
| **الگوی آدرس‌دهی فایل** | `${CDN_URL}/${encodeURIComponent(filename)}` (سرو مستقیم از ریشه CDN بدون پسوند اضافی) |
| **محل تزریق نشانی CDN** | **Payload Media Collection**: هوک `afterRead` و تابع `adminThumbnail` تا دیتابیس، پنل ادمین و Local API مستقیماً نشانی CDN را در فیلد `url` و `thumbnailURL` قرار دهند |
| **محدوده تصاویر** | تمامی تصاویر آپلودی CMS (رسانه‌ها، کاور کالا، گالری کالا، لوگوی برند). فایل‌های استاتیک وب (`public/assets/images`) در باندل وب باقی می‌مانند |
| **امنیت کش و بازنویسی** | کش Nginx CDN به صورت پیش‌فرض `public, max-age=0, must-revalidate, s-maxage=86400` یا نسخه‌دار تنظیم می‌شود و هدر CORS فعال است (`NGINX_CORS_ENABLE: "on"`) |

---

## ۳. فازبندی اجرایی

### فاز ۱: پیکربندی محیطی و استقرار (Environment & Compose)
1. **ویرایش `.env.example`**:
   - افزودن `CDN_DOMAIN=cdn.persianpart.shop`
   - افزودن `CDN_URL=https://cdn.persianpart.shop`
   - افزودن `VITE_CDN_URL=https://cdn.persianpart.shop`
2. **ویرایش `docker-compose.yml`**:
   - تزریق `CDN_URL: ${CDN_URL:-https://${CDN_DOMAIN:-cdn.persianpart.shop}}` به سرویس‌های `cms` و `api`.
   - در سرویس `web` افزودن متغیر زمان بیلد/اجرا برای `VITE_CDN_URL`.
   - نگاشت پورت محلی برای تست لوکال سرویس `cdn` در صورت نیاز (`8080:80`).

### فاز ۲: سازگاری هسته CMS (`apps/cms`)
1. **ویرایش `apps/cms/src/collections/media/media.collection.ts`**:
   - تنظیم تابع `adminThumbnail` در `upload` برای بازگرداندن نشانی کامل CDN از روی `doc.filename`.
   - افزودن هوک `afterRead` به کالکشن `Media` جهت بازنویسی `doc.url` و `doc.thumbnailURL` با فرمت CDN (`${CDN_URL}/${encodeURIComponent(doc.filename)}`).
2. **پشتیبانی در `seed.ts`**:
   - اطمینان از اینکه فایل‌های دمو سید در مسیر مشترک `media` کپی و بدون خطا در کالکشن ثبت شوند.
3. **اعتبارسنجی**: اجرای تست‌های hardening کالکشن مدیا (`pnpm --filter @persianpart/cms test:hardening`).

### فاز ۳: یکپارچه‌سازی لایه سرور API (`apps/api`)
1. **ویرایش `apps/api/src/routers/catalog.helpers.ts`**:
   - به‌روزرسانی تبدیل کاور و گالری کاتالوگ (`coverUrl` و `gallery`): در صورت وجود `url` آماده، همان را بازگرداند؛ در صورت وجود `filename`، نشانی CDN ساخته شود (به جای آدرس قدیمی `/api/media/file/`).
2. **ویرایش `apps/api/src/routers/order.helpers.ts` و روترها**:
   - اطمینان از اینکه خروجی آبجکت کالا در سفارشات نشانی کامل CDN را حمل کند.
3. **بهینه‌سازی `apps/api/src/server.ts`**:
   - مسیر خواندن فایل قدیمی `app.get('/api/media/*', ...)` به عنوان fallback برای محیط‌های تست لوکال حفظ شود.
   - اصلاح پاسخ‌های `url` در صورت آپلود دستی به نشانی استاندارد CDN.

### فاز ۴: سازگاری کلاینت وب (`apps/web`)
1. **ویرایش `apps/web/src/features/products/product-store.ts`**:
   - اصلاح تابع `resolveMediaUrl(media)`:
     - رشته‌های با پیشوند `http://` یا `https://` بدون تغییر بمانند (نشانی مستقیم CDN).
     - نام فایل‌های ساده (دارای پسوند بدون اسلش) با `VITE_CDN_URL` ترکیب شوند.
     - آبجکت‌های رسانه: اولویت اول `media.url`، سپس `media.thumbnailURL` و سپس ترکیب `media.filename` با `VITE_CDN_URL`.
2. **ویرایش `apps/web/src/features/orders/order-store.ts:201-204`**:
   - جایگزینی منطق دستی کاور با تابع متمرکز `resolveMediaUrl`.
3. **بررسی کامپوننت‌های مصرف‌کننده**:
   - `product-card.tsx`
   - `product-bottom-sheet.tsx`
   - `image-viewer-modal.tsx`
   - `order-entry-modal.tsx`
   - `cart-item-row.tsx`
   - `pre-invoice-modal.tsx`
   - صفحات سفارشات (`orders/index.tsx` و `orders/$id.tsx`)
   - تست بارگذاری پیش‌فرض و نمایش placeholder در صورت لود نشدن تصویر.

---

## ۴. ماتریس اعتبارسنجی و تست پذیرش (Claim-Matched Verification)

| ادعا | سناریو و آزمون تجربی | شاخص موفقیت |
| :--- | :--- | :--- |
| **ذخیره در Volume** | آپلود تصویر تست از پنل ادمین CMS | فایل `.webp` در مسیر `/app/apps/cms/media` و `/data` کانتینر CDN ایجاد شود. |
| **سرو مستقیم CDN** | ارسال درخواست `curl -I https://<CDN_DOMAIN>/<filename>.webp` | وضعیت `HTTP 200`، هدر `Content-Type: image/webp` و هدرهای مجاز CORS. |
| **خروجی API** | فراخوانی `api.catalog.list` و `api.catalog.getById` | فیلدهای `cover` و `gallery` حاوی URL کامل با پیشوند دامنه CDN باشند. |
| **رندرینگ کلاینت وب** | مشاهده کاتالوگ، مودال کالا و سبد خرید در مرورگر | سربرگ Network مرورگر نشان دهد ترافیک دانلود تصاویر فقط به سمت دامنه CDN می‌رود نه سرور وب یا API. |
| **عدم رگرسیون تایپ** | اجرای `pnpm check-types` و `pnpm build` روی تمام پروژه‌های مونو‌ریپو | کامپایل کامل و بدون خطای تایپ‌اسکریپت در تمام پکیج‌ها. |

---

## ۵. گام بعدی

پلن نهایی در فایل `.kilo/plans/1793216260147-shared-volume-nginx-cdn-plan.md` مستند شده است. برای پیاده‌سازی و تغییر فایل‌های پروژه، به ایجنت اجرایی تغییر وضعیت دهید.
