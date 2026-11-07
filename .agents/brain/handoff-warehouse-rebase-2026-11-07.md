> Historical artifact. The merged result and verification are recorded in [merge completion](warehouse-merge-completion-2026-11-07.md); current product documentation starts at [docs/README](../../docs/README.md). Original decisions/text below are retained.

# Handoff کامل — تفکیک انبار و ادغام ۲۱ کامیت remote

**تاریخ:** ۲۰۲۶/۱۱/۰۷، Asia/Tehran
**مخزن:** `/Users/mm25zamanian/Codes/persianpartshop.ir`
**وضعیت:** ادغام در حال انجام؛ تحویل نهایی و راستی‌آزمایی نسخهٔ ادغام‌شده انجام نشده است.
**درخواست آخر:** کاربر خواست به‌جای ادامهٔ اجرا، handoff کامل نوشته شود. این فایل نقطهٔ توقف است.

## ۱. مأموریت فعال و نقطهٔ دقیق توقف

مأموریت اصلی پیاده‌سازی تفکیک موجودی انبار، سبد و سفارش تک‌انباره، CSV و seed بود. این قابلیت ابتدا روی مبنای قدیمی مخزن پیاده‌سازی و آزموده شد. بعد کاربر متوجه شد `main` محلی ۲۱ کامیت از remote عقب بوده و خواست سرورهای dev متوقف، تغییرات remote تحلیل و rebase شوند؛ اگر تعارض هست از او سؤال شود.

**مأموریت فعلی که باید ادامه یابد:** تکمیل ادغام ترکیبی قابلیت انبار با ۲۱ کامیت جدید remote، حفظ تمام امکانات جدید remote، اعمال تصمیم‌های تأییدشدهٔ زیر، حل وضعیت unmerged در Git، و راستی‌آزمایی واقعی نسخهٔ نهایی. هیچ push/commit یا اجرای دوبارهٔ dev از طرف کاربر در این مرحله درخواست نشده است.

آخرین کارهای انجام‌شده پیش از درخواست handoff:

- متن working tree هر ۱۶ فایل متعارض بازسازی و بخشی از ادغام معنایی انجام شد؛ هنوز `git add` برای اعلام حل تعارض انجام نشده است.
- یک helper مشترک `getSalesFactor`، قرارداد واحد فروش، snapshot واحد سفارش و migration جدید آن اضافه شدند.
- snapshotهای سه migration محلی انبار بر snapshot schema جدید upstream بازپایه‌گذاری شدند؛ این تغییر **هنوز با PostgreSQL واقعی آزموده نشده است**.
- اجرای `generate:types` و `generate:importmap` موفق بود.
- آخرین typecheck اجراشده به دو خطا رسید: import استفاده‌نشدهٔ `selectionStore` در صفحهٔ محصول و استفاده از نقش حذف‌شدهٔ `support` در تست schema. هر دو بعداً در کد اصلاح شدند؛ **پس از این اصلاح‌ها typecheck کامل دوباره اجرا نشده است**.
- آخرین عمل قبل از interruption، خواندن seed، تست‌ها و mapper سفارش بود؛ مشخص شد seed هنوز نقش `support` را می‌سازد و باید اصلاح شود.
- در نوبت تهیهٔ handoff فقط وضعیت بررسی شد؛ هیچ ادغام یا اجرای تست تازه‌ای انجام نشد.

## ۲. تصمیم‌های قطعی کاربر — دوباره نپرسید

### دامنهٔ فیچر اصلی

- قیمت و markup مشتری برای هر محصول میان انبارها مشترک است؛ قیمت انبارمحور نداریم.
- موجودی هر زوج محصول/انبار مستقل است. جمع‌کردن انبارها، split قلم، سبد یا سفارش چندانباره و backorder خارج دامنه‌اند.
- هر سبد فعال یک انبار دارد و سفارش دقیقاً همان انبار را می‌گیرد.
- برای اولین قلم: صفر انبار قادر به تأمین → رد؛ یک انبار → انتخاب خودکار همراه نمایش نام؛ چند انبار → انتخاب صریح مشتری بدون پیش‌انتخاب.
- پس از binding، افزودن و تغییر مقدار فقط روی همان انبار بررسی شود؛ شکست سبد قبلی را دست‌نخورده حفظ کند.
- برای خرید از انبار دیگر ابتدا سبد فعلی ثبت یا خالی شود؛ حذف آخرین قلم binding را پاک می‌کند.
- یکتایی cart فقط در همان مرورگر است، نه سبد سروری مشترک میان دستگاه‌ها. حساب‌های مختلف نباید به draft هم دسترسی داشته باشند.
- سفارش اختصاصی بدون اقلام فعلاً متوقف شود؛ پیام: «ثبت سفارش اختصاصی فعلاً فعال نیست.»
- CSV موجودی **قابل فروش پس از کسر رزروها** را دارد. کاربر انبار را در مرحلهٔ ورود فایل انتخاب می‌کند؛ warehouseCode در هر ردیف لازم نیست.
- مدیر و مدیر کل هر دو مجوز مدیریت انبار و موجودی/CSV دارند. نقش پشتیبانی برای این کار تعریف نشود. remote اکنون نقش‌های انسانی manager/superadmin و نقش ماشین service دارد.

### تأیید صریح UI که قبلاً دریافت شده

کاربر متن زیر را تأیید کرد و مجوز در ادامه معتبر است:

- محصول/سبد: «انبار تأمین»، انتخاب صریح چندانبار، تک‌انبار خودکار، پیام «موجودی انبار انتخاب‌شده کافی نیست» با حفظ سبد.
- جزئیات سفارش: نام انبار.
- CMS: صفحه‌های «انبارها» و «موجودی انبار»، فیلتر سفارش بر اساس انبار، CSV با انتخاب انبار → پیش‌نمایش → اعمال.
- توقف سفارش اختصاصی و پیام آن.

این مجوز در پاسخ به قید UI فایل `.agents/brain/cms-hardening-plan.md` گرفته شد؛ برای همین تغییرات مجدداً درخواست تأیید نکنید. توسعهٔ بصری نامرتبط همچنان خارج دامنه است.

### تصمیم‌های قطعی پس از کشف ۲۱ کامیت remote

کاربر هر سه گزینهٔ زیر را انتخاب کرد:

1. **ادغام ترکیبی:** امکانات remote حفظ شوند و قابلیت انبار با معماری جدید سازگار شود.
2. **مهلت لغو ۶۰ دقیقه، مطابق remote.** ۳۰ دقیقهٔ مبنای قدیمی دیگر ملاک نیست.
3. **انبار برای همهٔ کالاها با واحد فروش خود کالا؛ کاشی همچنان متراژ/کارتن.** کالاهای other، مانند کیسه/عدد/کیلوگرم، نباید بی‌صدا به مترمربع تبدیل شوند.

## ۳. ترجیحات و قواعد همکاری

- کاربر از توقف‌های بی‌دلیل و پایان‌دادن نوبت با کار ناتمام ناراضی است. پس از handoff، در ادامهٔ مأموریت تا نتیجهٔ واقعی پیش بروید؛ فقط ابهام مادی/تعارض تصمیم جدید را سؤال کنید.
- قبلاً چند نوبت اجرای ناکافی و ادعای ناقص رخ داد؛ گزارش قبلی «کامل شد» مربوط به نسخهٔ قدیمی است و نباید به نسخهٔ ادغام‌شده تعمیم داده شود.
- `pnpm` تنها package manager؛ Bun runtime API است.
- قرارداد API در `packages/contract` مرجع است؛ API و Web شکل‌ها را مستقل بازتعریف نکنند.
- CMS مالک قیمت، lifecycle و موجودی؛ req را در عملیات nested Payload حفظ کنید تا transaction واحد بماند.
- TypeScript strict؛ از any جدید اجتناب؛ UI فارسی، RTL و logical layout.
- خواندن قبل ویرایش و سؤال، حفظ تغییرات کاربر و فایل‌های نامرتبط، تست مطابق ادعا.
- هیچ subagent فعالی وجود ندارد. توسعه‌دهنده delegation خودکار را منع کرده مگر درخواست صریح کاربر/مهارت.
- مهارت‌های مرتبط قبلاً خوانده شده‌اند: reasoning/execution، payload، orpc و orpc-contract، React، Persian RTL. برای APIهای کتابخانه Context7 و کد نصب‌شده ملاک باشند.

## ۴. تاریخچهٔ انجام کار در این گفتگو

1. کاربر پلن `.agents/brain/warehouse-separation-plan.md` را برای تحلیل داد.
2. ابهام‌های cart scope، custom order، معنای CSV و نقش‌ها با کاربر حل شدند؛ برنامهٔ اجرایی تولید شد.
3. ابتدا فقط guard seed اصلاح شد؛ کاربر چند بار به توقف کار اعتراض کرد.
4. سپس نسخهٔ اول قابلیت انبار روی HEAD قدیمی `8c39a55` پیاده‌سازی شد، تست‌ها و محیط موقت اجرا شدند.
5. UI جزئی به‌صورت صریح تأیید شد و پیاده شد.
6. کاربر PostgreSQL محلی را روشن کرد و reset/migration/seed و dev خواست. DB تنظیم‌شده وجود نداشت؛ `persianpart_cms` روی localhost:5432 ساخته شد، migrate:fresh و seed اجرا شد؛ سه dev بالا آمدند و health تأیید شد.
7. کاربر دربارهٔ مشتری تست پرسید اما tool را قطع کرد؛ پاسخ مشتری تست تحویل نشده است. اگر بعداً لازم بود دادهٔ محلی را بدون افشای secret بخوانید.
8. کاربر گفت ۲۱ کامیت remote پول نگرفته‌اند/دریافت نشده‌اند، سرورها را متوقف و تحلیل/rebase خواست. تفسیر عملی درخواست، دریافت upstream بود؛ موضوع تجاری مستقلی ساخته نشد.
9. devها متوقف، origin fetch، backup کامل ساخته، main به origin/main جلو برده شد. stash apply در ۱۶ فایل تعارض داد؛ از کاربر سؤال شد.
10. سه تصمیم ادغام بالا دریافت شد؛ ادغام معنایی شروع شد ولی در حال تکمیل است.
11. کاربر ادامه را قطع کرد و handoff کامل خواست؛ این فایل تهیه شد.

## ۵. وضعیت Git و بازیابی — بسیار مهم

- شاخهٔ فعال: `main`.
- HEAD فعلی و origin/main: `54eda5f`؛ قبل rebase: `8c39a55`.
- هیچ کامیت محلی جداگانه‌ای وجود نداشت؛ ۲۱ کامیت remote به main اضافه شدند. `git rebase origin/main` موفق شد.
- تعارض کنونی از **بازگرداندن تغییرات ثبت‌نشده با `git stash apply`** است؛ rebase sequencer باز نیست. بی‌دلیل `git rebase --continue` نزنید.
- Git هنوز ۱۶ مسیر را `UU` نشان می‌دهد، اگرچه conflict marker متن حذف و پایه‌ها بازنویسی شده‌اند. حذف marker به معنای حل/تست‌شدن semantic conflict نیست.
- index شامل stageهای قدیمی و تغییرهای staged/unstaged مخلوط است. پس از نهایی‌کردن فایل‌های مربوط، فقط مسیرهای حل‌شده را `git add` کنید. `git add -A` بی‌دلیل نزنید.
- پیش از rebase تعداد زیادی حذف skill/اسناد و تغییر AGENTS و lockfile از قبل وجود داشت؛ متعلق به کل کار محلی است و نباید پاک یا به‌عنوان تغییر این فیچر بازنویسی شود.
- ۸۷ فایل untracked پیش از stash با SHA-256 بعد apply تطبیق داده شدند؛ اختلاف صفر بود.
- stash **pop/drop نشده** و ref پایدار دارد. snapshot پیش از شروع ادغام را نگه دارید.

### شناسه‌های بازیابی

- شاخه: `codex/backup-pre-rebase-20261107-085624` → `8c39a55` (فقط مبنای commit قدیمی).
- snapshot کامل تغییرات محلی: `285129bec2e6ef43b3fd765756019c24860f01b7`.
- ref پایدار: `refs/codex/pre-rebase-20261107-085624`.
- پوشهٔ بازیابی: `/Users/mm25zamanian/Codes/persianpartshop.ir/.git/codex-backups/rebase-20261107-085624`.
- فایل pointer: `.git/codex-rebase-recovery-path`.
- محتوای backup: `tracked.patch`، `index.patch`، `status.z`، `recovery.json` با manifest فایل‌های untracked.
- نسخهٔ local هر فایل tracked پیش از ادغام با `git show 285129bec2e6ef43b3fd765756019c24860f01b7:<path>` قابل خواندن است.
- origin/main نسخهٔ upstream است. snapshot stash فقط نسخهٔ پیش از ادغام است؛ تغییرات آخر در working tree و migration جدید sales units هستند.
- هیچ commit/push یا deploy در این گفتگو انجام نشده است.

### ۱۶ مسیر که index هنوز unmerged دارد

```text
apps/api/src/routers/catalog.ts
apps/api/src/routers/order.ts
apps/cms/src/collections/orders/_apply-reservation.before-change.ts
apps/cms/src/collections/products/_sync-slug-and-dimensions.before-validate.ts
apps/cms/src/collections/products/components/ProductPreview.tsx
apps/cms/src/collections/products/products.collection.ts
apps/cms/src/migrations/index.ts
apps/cms/src/payload.config.ts
apps/web/src/features/checkout/pre-invoice-modal.tsx
apps/web/src/features/orders/order-store.ts
apps/web/src/features/products/product-store.ts
apps/web/src/routes/__root.tsx
apps/web/src/routes/orders/$id.tsx
apps/web/src/routes/product/index.tsx
apps/web/src/routes/product/new.tsx
packages/contract/src/order.ts
```

## ۶. تغییرات مهم ۲۱ کامیت remote که باید حفظ شوند

گزارش مفصل: `.agents/brain/rebase-origin-main-analysis-2026-11-07.md`.

- ۸۹ فایل تغییر؛ ۱۷۵۷۵ اضافه و ۲۷۸۰ حذف؛ ۱۰۳۰۳ خط اضافه مربوط به JSON snapshot migration است.
- حساب مشتری: مدارک، پروفایل، ban/status، allowedCategories، hideExactStock و disableOrdering.
- نقش‌های واقعی CMS: مدیر/مدیرکل و ماشین service؛ حذف support/editor از گزینه‌های role.
- AuditLogs و ثبت رویداد؛ API سرویس و مدیریت کاربر بازنگری شده‌اند.
- محصول tile/other، واحد اصلی/ثانویه، وزن، تعداد بسته و مشخصات اختیاری کاشی.
- حذف edit flow سفارش، refresh موجودی پس از ثبت/لغو، مهلت ۶۰ دقیقه.
- infinite scroll محصول ۲۴ و طرح ۱۲، دسترسی دسته‌بندی مشتری، اصلاح طرح‌های فعال و selection محصولات طرح.
- لوگوی CDN و چندین اصلاح invoice و چاپ و responsive.
- پاک‌سازی query cache هنگام logout و session polling.
- آپلود/حد اندازهٔ درخواست و تنظیمات dev/media.
- دو migration remote:
  - `20261101_151430_update_plans_is_active` (دامنهٔ بزرگ‌تر از نام: محصول other، مشتری/مدارک و audit نیز در آن است).
  - `20261104_082415_add_secondary_unit_to_products`.
- `prodMigrations` به config PostgreSQL اضافه شده است. این تنظیم واقعاً وجود دارد؛ عنوان commit تضمین zero-downtime را اثبات نمی‌کند.

## ۷. پیاده‌سازی اولیهٔ انبار — قبل rebase انجام شده

### CMS

- `collections/warehouses/warehouses.collection.ts`: code/name/isActive، code یکتا و ثابت، حذف ممنوع، مجوزهای مدیر/مدیرکل و خواندن ماشین.
- `collections/warehouse-stock/warehouse-stock.collection.ts`: زوج یکتا product/warehouse، inventorySqm/revision، nonnegative و precision، حذف/ویرایش مستقیم ممنوع، کارتن virtual، import UI.
- `_stock-operations.ts`: رزرو شرطی، restore و جایگزینی CAS در transaction req؛ validation همهٔ ورودی‌ها، مرتب‌سازی ID محصولات.
- orders: warehouse اجباری، warehouseName/Code snapshot، requestFingerprint، قفل سفارش و immutability، authoritative calculation، رزرو/لغو warehouse balance.
- stock global محصول در schema قدیمی باقی ولی در UI مخفی و نوشتن REST بسته؛ منبع عملیاتی انبار است.
- guard seed با تقدم DATABASE_URL سازگار با Payload شد.

### API/contract

- `warehouse.availability`: کل سبد، گردکردن کاشی به کارتن کامل، انبارهای قادر به تأمین، قیمت نهایی بدون base/markup، pagination و batch stock lookup.
- `warehouse-stock.helpers.ts`: hint کاتالوگ از بیشترین balance یک انبار فعال، هرگز جمع.
- `order.submit` و `shopping.createOrder` یک منطق، warehouseId، fingerprint و scoped idempotency.
- قرارداد پاسخ سفارش typed در مرزهای تغییرکرده و custom order غیرفعال.

### وب

- `selection-store.ts`: تنها draft واقعی؛ `cart-store.ts` adapter آن.
- ذخیرهٔ version 3 به تفکیک account، مهاجرت دو store قدیمی بدون حذف خاموش؛ conflict مقدار یک SKU با مقدار بزرگ‌تر و پیام بازبینی.
- بررسی async سبد پیش از اعمال mutation، انتخاب zero/one/multiple، حفظ سبد قبلی در خطا، generation guard و پاسخ‌های stale، storage event دو تب.
- submissionKey پایدار و snapshot ارسالی؛ موفقیت پاسخ قدیمی نباید ویرایش جدید یا cart حساب دیگر را پاک کند.
- `warehouse-selection.tsx`: modal و summary؛ modal در لایهٔ بالاتر از فرم‌های دیگر.
- preinvoice/order-store: پاسخ قطعی سرور، حذف local fake order، پاک‌کردن draft فقط بعد موفقیت.
- reorder به draft تازه و انتخاب فعلی انبار متصل شد.

### CSV

- وابستگی مستقیم `csv-parse@5.6.0` از قبل transitive موجود بود؛ مستقیم به CMS اضافه شد، نسخه‌های دیگر تغییر نکردند.
- انبار در سطح فایل، ستون دقیق `sku,inventorySqm`، یک تا هزار ردیف و یک مگابایت.
- preview بی‌اثر، signed token وابسته به actor/warehouse/rows/revision و expiry پانزده دقیقه.
- apply تراکنشی، CAS و ایجاد missing balance؛ خطای هر ردیف کل فایل را rollback می‌کند؛ SKU unknown/duplicate، مقدار منفی/precision غلط رد.
- export مستقل و واردکردن مقدار دستی از textarea همان CSV.
- import قیمت جهانی product مستقل و stock column قدیمی رد می‌شود.
- audit log اولیه در logger؛ remote اکنون collection audit دارد، سازگاری ثبت رویدادها بازبینی شود.

## ۸. ادغام فعلی — چه انجام شده و چه ناتمام است

### کارهای انجام‌شده پس از تأیید ادغام

- برای ۱۴ فایل متعارض upstream به‌عنوان پایه انتخاب شد؛ دو فایل `_apply-reservation.before-change.ts` و contract order از snapshot local پایه گرفتند. سپس تغییرات مرتبط پورت شدند. این انتخاب مرحله‌ای بود؛ نه اینکه همهٔ نتیجهٔ یکی از دو طرف کنار گذاشته شود.
- catalog API: `attachWarehouseStock` روی لیست و جزئیات اعمال شده و getUserPermissions/filter/hideExactStock upstream حفظ شده است.
- order API: پایهٔ upstream با محدودیت سفارش و ۶۰ دقیقه حفظ شد؛ submit مشترک export شد، fingerprint/scoped key/warehouse منتقل شد؛ precheck stock global با warehouse.availability عوض شد؛ custom فعلاً متوقف است.
- availability: getUserPermissions، رد hideExactStock/disableOrdering و allowedCategories افزوده شد؛ واحد/type در quote برمی‌گردد.
- `getSalesFactor` در `_inventory-math.ts`: other → ۱؛ tile → مقدار معتبر sqmPerCarton. export داخلی `@persianpart/cms/inventory` در package اضافه شد. **این export ابزاری داخلی است، package جدیدی ساخته نشده.**
- prepare CMS: قیمت و واحد سفارش از محصول، productType/unit/salesFactor در item snapshot؛ lock محصول حفظ شده.
- hook محصول: upstream دیگر fieldها را حفظ کرده؛ قفل concurrent بسته‌بندی افزوده و تغییر productType/unit کالای دارای balance ممنوع شده است.
- موجودی virtual برای other از مقدار واحد فروش و برای tile با factor کارتن محاسبه می‌شود.
- CSV token اکنون `productUpdatedAt` نیز دارد؛ هنگام apply محصول FOR SHARE خوانده و نسخه‌اش بررسی می‌شود تا پیش‌نمایش واحد قدیمی اعمال نشود.
- config: AuditLogs و prodMigrations upstream همراه انبارها و CSV local حفظ شد.
- Web: پایهٔ remote برای واحدها، infinite scroll و permissions حفظ؛ draft/quote/preinvoice/warehouse/reorder دوباره پورت شد.
- `lib/utils/unit.ts`: formatUnit از product-store خارج و re-export شده و summarizeQuantities اضافه شد؛ جمع مترمربع و تعداد کیسه نباید به‌عنوان یک متراژ واحد نمایش داده شود.
- CartItem شامل unit/productType، صفحهٔ cart و چاپ invoice تا حدی اصلاح واحد شده‌اند.
- orders mapper snapshot واحد/type و warehouseName را می‌خواند؛ مهلت ۶۰ دقیقهٔ upstream حفظ شد.
- `product/new` حذف خودکار کالاهای ناموجود در یک effect کنار گذاشته شد تا draft بی‌صدا پاک نشود؛ بقیهٔ filters/access upstream باید بازبینی شوند.
- migration جدید `20261107_090722_warehouse_sales_units.ts/json` با generator ایجاد شد؛ SQL فقط سه ستون orders_items: product_type/unit/sales_factor.
- index migrations اکنون ۸ migration دارد و ترتیب remote قبل warehouse حفظ است.

### نواقص/ریسک‌های مشخص برای ادامه

1. **seed هنوز نقش `support` می‌سازد** ولی enum remote فقط superadmin/manager/service است. این auto-merge اشتباه باید اصلاح و seed واقعی دوباره تست شود.
2. seed موجود عمدتاً tile است؛ fixture غیرکاشی با واحد فروش و balance لازم است و seed دوم نباید مقدار مصرف‌شده را reset کند.
3. `_schema-inspect.test.ts` هنوز `applyDown` را با `.slice(2).reverse()` اجرا می‌کند؛ بعد اضافه‌شدن migrationهای remote دیگر این یعنی فقط warehouse نیست و rollback قدیمی upstream را هم می‌زند. با فهرست/شناسهٔ دقیق migrationهای انبار اصلاح شود.
4. سه JSON snapshot محلی از schema remote با اعمال delta بازسازی شدند؛ generator migration جدید فقط سه ستون داد، اما صحت تمام snapshotها/constraintهای دستی با تست schema واقعی باید بررسی شود.
5. **تفاوت موجودی کیلوگرم/لیتر با واحدهای شمارشی:** کد فعلی factor=1 و Math.ceil دارد، پس همهٔ other را به واحد کامل گرد می‌کند. آیا kg/liter باید اعشاری باشند؟ کاربر فقط واحد فروش را تعیین کرد؛ کد remote هم واحد کامل در UI داشت. با شواهد دامنه تصمیم روشن و در تست پوشش دهید؛ ادعای پشتیبانی اعشار بدون پیاده‌سازی نکنید. cartonCount قرارداد integer است و در صورت اعشار باید interface سازگار تغییر کند، نه round خاموش.
6. `salesFactor/productType/unit` snapshot اضافه شده، اما تمام مسیرهای quote، checkout، cart totals و invoice برای other هنوز جامع بررسی نشده‌اند. helper `catalog.helpers.ts` نیز باید با semantics جدید تطبیق یابد.
7. preinvoice کارت ممکن است هنوز «کارتن/متراژ/متر» برای other نشان دهد؛ آخرین تغییر عمدتاً summary و cart-item-row و چاپ invoice بود. متن‌ها و aria-labelها را دقیق بررسی کنید.
8. source mapper غیرکاشی factor=1 دارد؛ اطراف آن calculations/slider/NumberField و ceilings و SKUهای بدون metadata تست شوند.
9. getUserPermissions upstream روی خطای lookup defaults permissive برمی‌گرداند؛ قابلیت جدید نباید bypass دسترسی ایجاد کند. endpointهای shopping قدیمی نیز باید hideExactStock/allowedCategories را رعایت کنند، نه صرفاً catalog اصلی.
10. order submit replay اکنون بعد از permission/precheck چه ترتیب دارد؟ اطمینان دهید retry سفارش ثبت‌شده پس از مصرف موجودی همان سفارش به‌اشتباه با insufficient stock شکست نخورد. fingerprint/order checks را با upstream error data هماهنگ کنید.
11. mock تست `warehouse.test.ts` هنوز fixture قدیمی دارد؛ productType/unit/category/status permission را باید پوشش دهد. contract quote فیلد جدید اجباری دارد؛ mock مرورگر نیز باید به‌روز شود.
12. `_products.test.ts` stub قفل بسته‌بندی مربوط به schema قبلی است؛ ستون product_type/unit جدید و null handling را بررسی و تست meaningful را حفظ کنید.
13. `selection-store` contract QuoteItem type/unit اضافه شده ولی legacy مهاجرت و browser mock هنوز با نسخهٔ قبلی‌اند. profile/session polling remote می‌تواند mock مرورگر را logout کند؛ session fixture را صحیح بسازید.
14. `reactivateOrder`/edit flow remnants و reorder صفحهٔ جزئیات/فهرست را دوباره بخوانید؛ مقصد ثبت باید order جدید باشد، نه edit قدیمی. همین قابلیت قبل rebase کار می‌کرد، اما اکنون base upstream دوباره پورت شده و آزموده نشده است.
15. `getSalesFactor` باعث وابستگی جدید import API به subpath CMS شده؛ resolver Bun/tsc/build/صادرات Docker و lockfile باید تأیید شوند.
16. changes به generated types بعد آخرین schema انجام شده؟ generate:types در ادامه دوباره اجرا شود؛ دستی ویرایش نکنید.
17. گزارش‌های docs/07-warehouses و warehouse-separation-implementation متعلق به نسخهٔ پیش rebase هستند؛ قواعد جدید ۶۰ دقیقه، همهٔ واحدها و آزمون‌های واقعی تازه را در پایان هماهنگ کنید.
18. Git index هنوز ۱۶ conflict دارد. پس از بررسی معنایی و verification فقط فایل‌های مربوط را stage کنید؛ stash/backup حفظ شود. هیچ commit از طرف کاربر درخواست نشده است.

## ۹. دیتابیس و سرویس‌ها

### وضعیت فعلی

- آخرین بررسی handoff: هیچ listener روی ۵۱۷۳/۵۱۷۴/۵۱۷۵ نیست؛ devها مطابق درخواست کاربر خاموش‌اند.
- PostgreSQL سیستمی محلی روشن مانده است؛ درخواست توقف مربوط به dev سرورها بود، نه خاموش‌کردن PostgreSQL.
- مقصد پروژه که قبلاً بررسی و روی آن مجوز reset گرفته شد: `localhost:5432/persianpart_cms` با role postgres. URI/رمز در handoff چاپ نشود.
- پیش از ساخت، آن DB وجود نداشت؛ DB ایجاد شد، ۵ migration قدیمی+انبار آن زمان و seed اجرا شدند؛ شامل ۲۶ محصول، ۲ انبار، ۵۲ balance، ۳ مشتری و ۵ سفارش بود.
- پس از fetch/rebase هیچ migration/reset/seed روی این DB کاری اجرا نشده. بنابراین schema DB **مربوط به قبل ۲۱ کامیت** است و با working tree جدید برابر نیست.
- آخرین مجوز reset کاربر مربوط به همین مقصد محلی بود؛ اگر ادامه نیاز به تغییر مجدد DB دارد، مقصد را مجدداً inspect و از اثر prodMigrations آگاه باشید. ترجیحاً integration checks ابتدا روی DB disposable مستقل.
- فایل‌های env کاری قبلاً تغییر نکردند؛ envهای موقت تست فقط به فرایندهای آزمایش داده شدند.
- API و CMS env قبل rebase CMS_URL=localhost:5174 و API key همسان داشتند؛ secretها چاپ نشوند.

### محیط‌های آزمایشی قبلی

- PostgreSQL موقت با initdb/pg_ctl روی یک پورت آزاد برای integration test ساخته و در پایان نسخهٔ اول متوقف شد.
- `/tmp/persianpart-warehouse-test-target.json` ممکن است فقط آدرس محیط متوقف‌شده را داشته باشد؛ زنده فرض نکنید.
- ابزارهای postgres/initdb در `/opt/homebrew/bin` در دسترس بودند.
- `test:hardening:postgres` جدول‌های fixture را drop/truncate می‌کند؛ فقط DB disposable با نام guardشده `cms_hardening_test` روی loopback و پورت معلوم.
- `test:hardening:migrations` کنترل URI به `/postgres` می‌گیرد و DB تصادفی خودش را ایجاد و حذف می‌کند.

## ۱۰. نتایج تست تاریخی در برابر وضعیت ادغام فعلی

### پیش از rebase واقعاً اجرا و موفق شد

- ۷۲ تست CMS hardening.
- ۴ تست Bun API availability/idempotency/custom/auth.
- ۸ تست PostgreSQL warehouse isolation، reserve/cancel race، CAS و rollback.
- تست migrations و schema metadata، Payload Local API واقعی و CSV authorization/preview/apply/replay/tamper.
- seed دوبار روی DB موقت؛ مقایسهٔ تمام ۵۲ balance شامل edit دستی و رزروها برابر بود.
- Chromium با API mock: legacy migration، zero/one/multiple، keyboard selection، account race، دو تب، submit race، retry همان key، موفقیت و reorder انبار تازه؛ responsive ۳۶۰/۱۲۸۰.
- Chromium به CMS واقعی و DB موقت: manager login، preview/apply و mobile/desktop.
- API router با `call` به SDK و REST CMS و PostgreSQL واقعی: quote، submit، replay، cancel و restore دقیق. OTP/SMS واقعی در این بررسی استفاده نشد.
- build CMS/Web و typecheck API؛ هشدار bundle بزرگ وب از قبل باقی بود.

### پس از شروع ادغام فعلی

- generate:types و generate:importmap موفق.
- چند بار API typecheck خروجی خطا نداشت؛ آخرین کل مجموعه پس از تغییرهای بعدی دوباره اجرا نشده است.
- دو خطای TypeScript Web/CMS ذکرشده اصلاح شدند اما هنوز نتیجهٔ جدید نداریم.
- هیچ تست runtime/Postgres/browser یا build نهایی روی نسخهٔ ادغام‌شده اجرا نشده است.
- `git diff --check -- apps packages docs` در تهیهٔ handoff بدون گزارش whitespace بود؛ این معادل صحت semantic یا پایان conflict نیست.
- بررسی marker با الگوی گسترده `=======` کامنت‌های separator را هم گزارش می‌کرد؛ برای marker واقعی `^(<<<<<<<|=======|>>>>>>>)` و وضعیت index جدا بررسی شوند.

## ۱۱. مسیر ادامهٔ پیشنهادی تا پایان مأموریت

1. ابتدا AGENTS و فایل‌های موجود را بخوانید؛ `git status` و شناسه‌های recovery را تأیید کنید. سرورها را بی‌درخواست روشن نکنید.
2. ادغام semantic تمام ۱۶ فایل را با `origin/main` و snapshot local مقایسه کنید. upstream permissions، واحدها، invoice و ۶۰ دقیقه را حفظ کنید؛ stock محصول نباید دوباره منبع فروش شود.
3. موارد مشخص بخش ۸ را رفع کنید؛ seed نقش‌ها، واحدهای غیرکاشی، schema snapshots و rollback تست اولویت دارند.
4. contract/DTOها و واحد snapshot و line totals را کامل کنید؛ ضریب کاشی را به کالاهای other اعمال نکنید. قیمت نهایی از CMS و quote باشد و تخفیف/مالیات نمایشی خودساخته ایجاد نشود.
5. تست‌های mixed cart و same-warehouse availability، other units، permissions و منع افشای stock، ۶۰ دقیقه، retry/idempotency و reorder را اضافه/به‌روز کنید.
6. generated types/importMap را با generator تولید؛ typecheck narrow سپس Web/CMS build.
7. migrationهای ادغام‌شده را روی DB موقت خالی به ترتیب کامل، metadata، CRUD و reserve/cancel/import تست کنید. fixture update/reseed idempotency را اثبات کنید.
8. مرورگر با mock جدید session/permission و type/unit را تست کنید؛ بررسی live CMS/API/DB روی محیط موقت انجام شود. هیچ SMS واقعی خودکار نفرستید.
9. وقتی فایل‌های متعارض حقیقتاً حل شدند، مسیرهای مشخص را git add کنید تا unmerged صفر شود. commit/push بدون درخواست نسازید؛ backup را حذف نکنید.
10. گزارش تحلیل و implementation را با نتیجهٔ جدید هماهنگ کنید. تفکیک کنید چه تستی واقعی بوده و چه mock، چه migrationی روی کدام DB اجرا شده است.
11. تحویل نهایی: main همگام remote، کار انبار سازگار با همهٔ امکانات remote، صفر conflict/marker، checkهای متناسب موفق یا blocker صریح؛ devها همچنان خاموش مگر کاربر بخواهد دوباره بررسی کند.

### فرمان‌های راهنما (پس از خواندن manifest)

```bash
git status --short
git diff --name-only --diff-filter=U
git rev-list --left-right --count HEAD...origin/main
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm --filter @persianpart/api typecheck
pnpm --filter @persianpart/web exec tsc --noEmit
pnpm --filter @persianpart/cms exec tsc --noEmit --incremental false
pnpm --filter @persianpart/cms test:hardening
pnpm --filter @persianpart/api test
pnpm --filter @persianpart/cms test:hardening:postgres
pnpm --filter @persianpart/cms test:hardening:migrations
pnpm --filter @persianpart/web build
pnpm --filter @persianpart/cms build
```

دو فرمان postgres/migration باید با envهای disposable صحیح و guardها اجرا شوند؛ اجرای skip مدرک pass نیست. `pnpm dev` در root اکنون recursion دارد (`"dev":"pnpm dev"`)؛ اگر دوباره dev خواسته شد فرمان workspaceها را مستقیم و جدا اجرا کنید. اصلاح scripts root در دامنهٔ این ادغام نبوده است.

## ۱۲. اسناد و اشاره‌گرها

- `.agents/brain/warehouse-separation-plan.md` — طرح اولیه و مرزهای دامنه؛ بعضی فرض‌ها با پاسخ‌های این handoff جایگزین شدند.
- `.agents/brain/warehouse-separation-implementation.md` — گزارش نسخهٔ اول قبل rebase؛ مدرک تست نسخهٔ فعلی نیست.
- `.agents/brain/rebase-origin-main-analysis-2026-11-07.md` — تحلیل ۲۱ commit و ۱۶ تعارض، backupها و پیشنهاد قبل پاسخ کاربر.
- `docs/07-warehouses.md` و `docs/examples/warehouse-stock.csv` — راهنمای فعلی فیچر؛ پس از ادغام واحدها باید به‌روزرسانی شوند.
- `apps/web/e2e/warehouse.js` — سناریوی Chromium با mock؛ با session polling و quote جدید سازگار شود.
- `apps/cms/src/_schema-inspect.test.ts` و تست‌های orders/warehouse-stock — آزمون‌های schema و تراکنش.

[NEXLOAD HANDOFF]
From: Primary engineering assistant / execution
To: Next implementing engineer or agent
Context Pointer: .agents/brain/handoff-warehouse-rebase-2026-11-07.md
Established Facts:
- main at 54eda5f matches origin/main; remote rebase completed, stash restoration created 16 unmerged index paths.
- Working files have partial combined resolutions; full merged tests have not run.
- Three dev servers are stopped; local working DB still has pre-upstream schema.
Hard Constraints:
- Preserve remote features and local warehouse implementation; preserve unrelated user changes and durable stash.
- No unsupported completion claims, no secrets, no implicit DB reset or deployment.
Settled Decisions:
- Combined merge approved, cancellation 60 minutes, warehouse stock for every product in its own selling unit.
- Single warehouse per local browser cart/order, shared price, explicit selection for multiple eligible warehouses.
Next Cognitive Objective:
- Complete semantic merge, fix seed/unit/migration/test gaps, verify on disposable PostgreSQL and browser, mark only actual resolved files, and deliver a verified conflict-free worktree without restarting dev unless requested.
[END HANDOFF]
