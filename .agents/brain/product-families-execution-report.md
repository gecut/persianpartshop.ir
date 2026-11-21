# گزارش اجرای ویژگی «طرح» (خانوادهٔ محصول)

تاریخ: ۲۱ نوامبر ۲۰۲۶  
مبنای مخزن: کامیت `52219a4`  
شاخه: `feat/product-families`  
وضعیت کلی: اجرای کامل گام‌های ۱ تا ۶ مطابق پلن و طراحی مستند در شاخه کاری (Uncommitted)

---

## ۱. خلاصه تغییرات به تفکیک Task

### Task 1: CMS — مجموعه `product-families`، رابطه، محافظت حذف، لاگ و مایگریشن
- **ایجاد:**
  - `apps/cms/src/collections/product-families/product-families.collection.ts`
  - `apps/cms/src/collections/product-families/index.ts`
  - `apps/cms/src/collections/products/_family-change.ts`
  - `apps/cms/src/collections/products/_family-change.test.ts`
  - `apps/cms/src/migrations/20261121_120000_product_families.ts`
- **ویرایش:**
  - `apps/cms/src/collections/products/products.collection.ts` (افزودن فیلد رابطه `family` در تب مشخصات و هوک لاگ تغییرات)
  - `apps/cms/src/payload.config.ts` (ثبت مجموعه در `protectBusinessRelations`)
  - `apps/cms/src/lib/protect-relations.ts` (افزودن پیام خطای محافظت حذف برای `products.family`)
  - `apps/cms/src/migrations/index.ts` (ثبت مایگریشن در لیست مایگریشن‌ها)
  - `apps/cms/package.json` (افزودن فایل تست واحد جدید به اسکریپت `test:unit`)
  - `apps/cms/src/payload-types.ts` (تایپ‌های تولیدشده خودکار)

### Task 2: قرارداد و API — فیلد `familyId` در `CatalogRecord`
- **ویرایش:**
  - `packages/contract/src/catalog.ts` (افزودن فیلد اختیاری `familyId` به `CatalogRecordSchema`)
  - `apps/api/src/routers/catalog-sync.ts` (افزودن `family: true` به `productProjection` و استخراج شناسه در `catalogRecord`)
  - `apps/api/src/routers/catalog.helpers.ts` (تابع کمکی خالص `familyIdOf`)
- **ایجاد:**
  - `apps/api/src/routers/catalog-record.test.ts` (تست واحد نرمال‌سازی شناسه طرح و حذف آبجکت خام رابطه)

### Task 3: برنامه وب (Web) — استخراج محلی اعضای طرح و بخش مودال
- **ایجاد:**
  - `apps/web/src/modules/catalog/catalog-family.ts` (تابع خالص `familyMembers` با ترتیب استاندارد)
  - `apps/web/src/modules/catalog/catalog-family.test.ts` (تست‌های واحد ترتیب و فیلتر اعضا)
  - `apps/web/src/modules/products/product-bottom-sheet/_use-family-options.ts` (هوک استخراج گزینه‌ها از کش محلی `byId`)
  - `apps/web/src/modules/products/product-bottom-sheet/_product-family-options.tsx` (کامپوننت نمایش ردیف‌های گزینه‌ها)
  - `apps/api/src/routers/offline-data.test.ts` (تست حفظ `familyId` در داده‌های ساختاری آفلاین)
- **ویرایش:**
  - `apps/web/src/modules/products/product-bottom-sheet/product-bottom-sheet.tsx` (اتصال گزینه‌ها بعد از مشخصات فنی و ریست zoom)
  - `apps/web/src/modules/products/product-list/product-list.view.tsx` (اتصال `onViewProduct`)
  - `apps/web/src/modules/plans/plan-card/plan-card.tsx` (اتصال `onViewProduct`)

### Task 4: قرارداد و CMS — فیلد عمومی `familyOptions`
- **ویرایش:**
  - `packages/contract/src/public-catalog.ts` (اسکیمای `PublicCatalogFamilyOptionSchema` و فیلد اجباری `familyOptions` در خروجی عملیات `product`)
  - `packages/contract/src/public-catalog.test.ts` (تست اسکیمای عمومی و اعتبارسنجی خروجی)
  - `apps/cms/src/modules/catalog/catalog-query-types.ts` (افزودن `familyId` به `CatalogQuery`)
  - `apps/cms/src/modules/catalog/catalog-query-sql.ts` (بستن پرانتز شرط خط‌مشی و پارامتری کردن شرط `p.family_id = $n`)
  - `apps/cms/src/modules/catalog/catalog-service.ts` (فراخوانی اعضای خانواده تا سقف ۱۰۰ و نگاشت)
  - `apps/cms/src/modules/catalog/catalog-mapper.ts` (تابع `toFamilyOption` با حفظ حالت‌های قیمت/موجودی مخفی)
  - `apps/cms/src/modules/catalog/catalog-mapper.test.ts` (تست‌های نگاشت عضو خانواده)
- **ایجاد:**
  - `apps/cms/src/modules/catalog/catalog-query-sql.test.ts` (تست پارامتری بودن و پرانتز شرط در SQL)

### Task 5: برنامه کاتالوگ عمومی (Catalog) — بخش گزینه‌های طرح
- **ایجاد:**
  - `apps/catalog/src/modules/product/_family-options-order.ts` (تابع خالص مرتب‌سازی گزینه‌ها)
  - `apps/catalog/src/modules/product/_family-options-order.test.ts` (تست‌های واحد مرتب‌سازی)
  - `apps/catalog/src/modules/product/_product-family-options.tsx` (کامپوننت نمایش گزینه‌ها با لینک‌های `/p/[id]`)
- **ویرایش:**
  - `apps/catalog/src/modules/product/product.view.tsx` (درج بخش گزینه‌ها بعد از مشخصات)
  - `apps/catalog/src/components/product-values.tsx` (پذیرش `PublicCatalogFamilyOption` در مقادیر ابعاد)
  - `apps/catalog/src/modules/product/_product-share-metadata.test.ts` (تنظیم `familyOptions: []` در فیچرها مطابق با نوع الزامی خروجی)

### Task 6: مستندات و گزارش نهایی
- **ویرایش:**
  - `docs/11-product-creation-standards.md` (افزودن بخش ضوابط رابطه «طرح» و خانواده محصول)
  - `docs/12-public-catalog.md` (افزودن بخش گزینه‌های خانواده محصول در کاتالوگ عمومی)
- **ایجاد:**
  - `.agents/brain/product-families-execution-report.md` (این سند)

---

## ۲. دستورهای اعتبارسنجی و نتایج مشاهده‌شده واقعی

فرمان‌های زیر در این مرحله اجرا شده و نتایج عینی زیر را ثبت کرده‌اند:

### الف) بررسی وابستگی‌ها و لایه‌بندی معماری (`pnpm check:deps`)
```
$ bun x --bun depcruise apps/web/src --config .dependency-cruiser.cjs --ts-config apps/web/tsconfig.json --output-type err && bun x --bun depcruise apps/cms/src --config .dependency-cruiser.cjs --ts-config apps/cms/tsconfig.json --output-type err && bun x --bun depcruise apps/api/src --config .dependency-cruiser.cjs --ts-config apps/api/tsconfig.json --output-type err

✔ no dependency violations found (291 modules, 1105 dependencies cruised)
✔ no dependency violations found (166 modules, 438 dependencies cruised)
✔ no dependency violations found (161 modules, 451 dependencies cruised)
```
- **نتیجه:** موفق (Exit 0) — هیچ چرخهٔ وابستگی یا نقض لایه‌های معماری وجود ندارد.

### ب) بررسی انواع تایپ‌اسکریپت (`pnpm check-types`)
```
$ pnpm -r exec tsc --noEmit
```
- **نتیجه:** موفق (Exit 0) — تمام بسته‌ها و برنامه‌ها بدون هیچ خطای تایپی کامپایل شدند.

### ج) اجرای آزمون‌های واحد سراسری (`pnpm test:unit`)
```
$ pnpm --filter @persianpart/catalog test && pnpm --filter @persianpart/cms test:unit && pnpm --filter @persianpart/api test && pnpm --filter @persianpart/web test:unit
```
- **تفکیک خروجی:**
  - **`@persianpart/catalog`:** ۱۲ تست موفق، ۰ تست ناموفق (۲۴۰ میلی‌ثانیه).
  - **`@persianpart/cms`:** ۶۰ تست موفق، ۰ تست ناموفق (شامل تست‌های قرارداد کاتالوگ عمومی و تست‌های جدید CMS).
  - **`@persianpart/api`:** ۱۶ تست موفق در ۴ فایل، ۵۷ عبارت `expect()`، ۰ خطا (۱۲۶ میلی‌ثانیه).
  - **`@persianpart/web`:** ۵۵ تست موفق در ۱۰ فایل، ۱۳۸ عبارت `expect()`، ۰ خطا (۸۰ میلی‌ثانیه).
- **نتیجه:** موفق (Exit 0) — مجموع ۱۴۳ تست بدون خطا پاس شدند.

---

## ۳. شواهد و یافته‌های مشاهده‌شده توسط بازبین (Verifier)

### Task 1
- تایپ‌چک CMS با موفقیت پاس شد (`tsc --noEmit`).
- ۵۷/۵۷ تست واحد اولیه CMS پاس شدند.
- **تمرین مایگریشن (Migration rehearsal)** بر روی یک دیتابیس محلی تازه و یک‌بارمصرف ساخته‌شده از زنجیره جاری انجام شد:
  - زنجیره کامل از ابتدا تا انتها با موفقیت اجرا شد.
  - اعمال این مایگریشن جدید به‌تنهایی، هش دایجست محصولات را کاملاً ثابت نگه داشت (`family_id` همه محصولات `NULL` باقی ماند).
  - ایجاد ایندکس `products_family_idx` و کلید خارجی با مشخصه `ON DELETE RESTRICT` تایید شد.
  - حذف طرح با عضو غیرفعال با پیام خطا بلاک شد؛ حذف طرح خالی با موفقیت انجام شد.
  - جابه‌جایی یک کالا تنها همان رکورد را جابه‌جا کرد.
  - دستور `migrate:down` منحصراً همین مایگریشن را برگرداند.
  - دیتابیس تستی پس از خاتمه حذف گردید.

### Task 3
- تایپ‌چک Web بدون خطا پاس شد.
- ۵۵ تست واحد Web و ۱۶ تست واحد API با موفقیت اجرا شدند.
- دستور `check:deps` بدون خطا عبور کرد.
- بیلد کلاینت وب (`pnpm --filter @persianpart/web build`) با موفقیت انجام شد.

### Task 5
- فایل تست رهگیری‌شده `apps/catalog/src/modules/product/_product-share-metadata.test.ts` صرفاً برای اضافه کردن `familyOptions: []` به fixtureها ویرایش شد؛ هیچ شرط یا رفتاری در تست تغییر نیافت و علت آن، الزامی شدن فیلد در اسکیمای خروجی عملیات `product` بود.

---

## ۴. موارد بررسی‌نشده / وضعیت [UNKNOWN]

موارد زیر به دلیل عدم راه‌اندازی سرورهای محلی، مرورگر زنده و دیتابیس واقعی در این محیط اجرا نشده‌اند و مطابق با ضوابط پروژه با برچسب `[UNKNOWN]` مشخص می‌شوند:

1. **بررسی دستی ادمین (`[UNKNOWN]`):**
   - عملکرد ویرایش گروهی (Edit many) در فهرست محصولات برای انتساب طرح.
   - نمایش صحیح لیست اعضا در Join list تب طرح در پنل ادمین.
   - نمایش پیام محافظت حذف (`referenceActions`) با متن دقیق «ابتدا طرح را از فرم کالاهای عضو بردارید یا تغییر دهید.» در رابط کاربری ادمین.
2. **بررسی دستی مرورگر وب (`[UNKNOWN]`):**
   - جابه‌جایی سریع بین گزینه‌ها (A↔B و A→B→A) و اطمینان از ریست‌شدن گالری تصاویر، QR و انتخاب بزرگ‌نمایی به محصول فعال.
   - استقلال سبد خرید و چک‌باکس انتخاب هنگام مشاهده سایر گزینه‌ها.
   - تغییر گزینه از طریق PlanCard و غیرفعال ماندن سفارش‌گذاری.
   - بررسی چیدمان در نمایشگرهای موبایل (۳۷۵px) و فوکوس کیبورد.
3. **بررسی دستی مرورگر کاتالوگ عمومی (`[UNKNOWN]`):**
   - پیمایش پیوندها و تغییر آدرس URL و عنوان صفحه.
   - اطمینان از عدم حضور قیمت یا موجودی در DOM و مشخصه‌های `aria-label` در صورت فعال بودن حالت‌های مخفی (`hidden`).
   - بررسی تگ‌های متادیتا و `noindex` بودن کاتالوگ.
4. **بررسی پایگاه‌داده واقعی PostgreSQL برای `familyOptions` کاتالوگ عمومی (`[UNKNOWN]`):**
   - ارزیابی رفتار کوئری زنده همراه با استثناها (exclusions)، اضافات دستی (additions) و حالت توقف (pause).
