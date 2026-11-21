# پلن اجرایی خانوادهٔ محصول

تاریخ: ۲۰۲۶-۱۱-۲۱ — مبنای بررسی مخزن: `52219a4`

وضعیت: معماری و دامنه در گفتگو تأیید شده؛ این فایل دستور اجرای آینده است، نه گزارش پیاده‌سازی. در زمان نگارش، کد محصول یا دادهٔ CMS تغییر نکرده است.

مخاطب: مدل اجراکننده‌ای که به گفتگو دسترسی ندارد. ترتیب مراحل، مالکیت داده و رفتارهای این سند را رعایت کن. نام فایل‌های جدید در این سند پیشنهاد اجرایی قطعی است؛ اگر مخزن جلو رفته، محل متناظر را پیدا کن، بدون بازطراحی قابلیت.

## ۱. نتیجه و تصمیم‌های قطعی

هر محصول همچنان یک کالای مستقل با شناسه، SKU، قیمت، موجودی، بسته‌بندی، تصاویر و سابقهٔ سفارش خودش است. یک رابطهٔ اختیاری، محصولات انتخاب‌شده توسط مدیر را در «خانوادهٔ محصول» کنار هم قرار می‌دهد. گزینه‌های خانواده در مودال Web و صفحهٔ جزئیات Catalog عمومی دیده می‌شوند.

| موضوع | تصمیم |
| --- | --- |
| نام | فارسی: خانوادهٔ محصول؛ مجموعه: `product-families`؛ رابطه روی محصول: `family` |
| تعداد عضویت | صفر یا یک خانواده برای هر محصول؛ چندعضویتی هم‌زمان ممنوع |
| تشخیص عضویت | کاملاً دستی؛ از برابری نام، SKU، رنگ یا برچسب نتیجه‌گیری خودکار نکن |
| تفاوت اعضا | درجه، لعاب، اندازه، رنگ و سایر ویژگی‌ها می‌توانند متفاوت باشند؛ شرط برابری برند/دسته/نوع اضافه نکن |
| انتقال | تغییر `family` یک محصول فقط همان محصول را منتقل می‌کند |
| تغییر نام خانواده | یک ویرایش در رکورد خانواده؛ نام روی محصولات کپی نمی‌شود |
| دامنهٔ نمایش | هر دو مصرف‌کننده: `apps/web` و `apps/catalog` |
| سیاست Web | فعال بودن محصول، دسترسی دسته، قیمت اختصاصی و محدودیت موجودی کاربر فعلی |
| سیاست Catalog | سیاست انتشار عمومی، قیمت عمومی و حالت موجودی عمومی برای تک‌تک اعضا |
| معنای انتخاب گزینه | مشاهدهٔ محصول دیگر؛ افزودن به انتخاب خرید/سبد اقدام جداگانه است |

جزئیات فنی و UX بخش‌های بعد، تصمیم طراحی این پلن‌اند؛ با پاسخ مستقیم کاربر اشتباه نگیر، ولی اجرا را به حدس یا انتخاب معماری تازه واگذار نکن.

### خارج از دامنه

- محصول مادر قابل فروش، ماتریس variant، تولید ترکیب‌های جدید یا بازتعریف SKU نداریم.
- قیمت، عکس، موجودی، بسته‌بندی یا مشخصات از خانواده به اعضا ارث نمی‌رسد.
- ادغام کارت‌های فهرست، جست‌وجوی خانواده، صفحهٔ خانواده، فیلتر خانواده و تغییر URL محصولات نداریم.
- فیلد تازهٔ لعاب، برچسب کوتاه variant، ترتیب دستی، محصول پیش‌فرض و وضعیت انتشار مستقل خانواده اضافه نکن.
- داده‌های واقعی را گروه‌بندی یا اصلاح نکن. Backfill از نام و اجرای mutation از MCP بخشی از این پلن نیست.
- تغییر سیاست مشترک ACL، افزودن سرویس/وابستگی، بازنویسی coordinator و اشتراک‌گذاری UI بین Web و Catalog مجاز نیست.
- این سند مجوز commit، push، استقرار یا اجرای migration روی پایگاه مشترک/تولید نیست.

## ۲. شواهد مبنا و نقاط ورود

در خواندن MCP، ۶۶۸ محصول یافت شد؛ ۴۰۸ محصول در ۱۶۱ نام دقیقاً تکراری قرار داشتند. این آمار خانوادهٔ قطعی نیست. نمونهٔ «آلاوس سفید» چهار محصول فعال داشت: مات درجهٔ ۱ (`197`)، مات درجهٔ D (`615`)، پولیش درجهٔ ۱ (`614`) و پولیش درجهٔ D (`7`). این شناسه‌ها فقط شاهد تحلیل‌اند، نه fixture یا هدف mutation.

در مدل فعلی، `grade` فیلد مستقل است، ولی لعاب در نام و برچسب‌ها بیان می‌شود. هیچ parser تازه‌ای برای استخراج لعاب از نام نساز.

| مسیر موجود | مسئولیت مرتبط |
| --- | --- |
| `apps/cms/src/collections/products/products.collection.ts` | مدل محصول و ثبت تغییرات |
| `apps/cms/src/payload.config.ts` | ثبت collectionها، محافظ روابط و adapter |
| `apps/cms/src/lib/protect-relations.ts` | جلوگیری از حذف رکورد دارای ارجاع |
| `apps/cms/src/lib/restrict-foreign-keys.ts` | `RESTRICT` برای روابط تجاری PostgreSQL |
| `apps/cms/src/mcp/config.ts` | مجموعه‌های MCP و guardهای نوشتن |
| `packages/contract/src/catalog.ts` | `CatalogRecordSchema` و قرارداد commerce |
| `apps/api/src/routers/catalog-sync.ts` | projection، scope، hydration و تبدیل امن محصول |
| `apps/api/src/routers/catalog.ts` | تجمیع procedureها و خواندن تکی/QR |
| `apps/api/src/routers/offline-data.ts` | ساخت بستهٔ آفلاین از `syncPage` |
| `apps/web/src/modules/catalog/catalog-coordinator.ts` | مالک ادغام رکوردها، ترتیب پاسخ‌ها و تغییر scope |
| `apps/web/src/modules/catalog/catalog-data.ts` | transport و hookهای دادهٔ مشترک |
| `apps/web/src/modules/products/product-bottom-sheet/product-bottom-sheet.tsx` | مودال محصول |
| `apps/web/src/modules/products/product-list/product-list.view.tsx` | مالک محصول فعال و انتخاب خرید |
| `apps/web/src/modules/plans/plan-card/plan-card.tsx` | دومین مصرف‌کنندهٔ مودال؛ حالت مشاهده |
| `packages/contract/src/public-catalog.ts` | DTO عمومی و عملیات `product` |
| `apps/cms/src/modules/catalog/catalog-service.ts` | مالک سیاست، query، hydration و DTO عمومی |
| `apps/cms/src/modules/catalog/catalog-query-types.ts` | ورودی query داخلی CMS |
| `apps/cms/src/modules/catalog/catalog-query-sql.ts` | SQL پارامتری قیمت/موجودی/انتشار |
| `apps/cms/src/modules/catalog/catalog-mapper.ts` | حذف اطلاعات داخلی و اعمال حالت نمایش عمومی |
| `apps/catalog/src/lib/catalog-server.ts` | خواندن cacheشدهٔ محصول با ISR فعلی |
| `apps/catalog/src/modules/product/product.view.tsx` | صفحهٔ جزئیات عمومی |
| `docs/12-public-catalog.md` | مرز مستقل Catalog، سیاست‌ها و محدودیت تازگی |

قابلیت Join در Payload رابطهٔ معکوس را بدون ذخیرهٔ دوبارهٔ عضویت نمایش می‌دهد: <https://payloadcms.com/docs/fields/join>. تنظیم رابطهٔ تک‌مقداری: <https://payloadcms.com/docs/fields/relationship>. نسخهٔ نصب‌شده و تایپ‌های محلی را پیش از استفاده از APIهای دقیق بررسی کن؛ از API حدسی استفاده نکن.

## ۳. مدل داده و مدیریت

### ۳.۱ مجموعهٔ خانواده‌ها

فایل جدید: `apps/cms/src/collections/product-families/product-families.collection.ts`، export نام‌دار `ProductFamilies`.

- `slug: 'product-families'`؛ برچسب مفرد/جمع «خانوادهٔ محصول» / «خانواده‌های محصول»؛ گروه ادمین «محصولات و کاتالوگ».
- `name`: متن required، trim، حداکثر ۱۶۰ کاراکتر، رد مقدار تماماً whitespace. `useAsTitle: 'name'`.
- یکتایی هویت با `id` است؛ نام را global unique نکن. برای نام‌های مشابه، مدیر می‌تواند برند/شرح را در نام خانواده بیاورد.
- فیلد مجازی `products` از نوع `join`، `collection: 'products'` و `on: 'family'`؛ ستون‌ها: نام، SKU، درجه، ابعاد، رنگ و فعال بودن. صفحه‌بندی بومی ادمین حفظ شود.
- `read: isAdminAuthenticated` و create/update/delete با `isCatalogManager`؛ مشابه مجموعهٔ Products، بدون دسترسی عمومی خام.
- خانواده فقط `name` و timestamps بومی دارد؛ slug، توضیحات، تنظیم قیمت و انتشار اضافه نکن.

### ۳.۲ رابطهٔ محصول

در تب مشخصات محصول، فیلد `family` از نوع relationship به `product-families` اضافه کن:

- اختیاری، `hasMany: false`، `index: true`؛ مقدار خالی یعنی بدون خانواده.
- روی این فیلد `unique: true` نگذار؛ چند محصول باید بتوانند یک خانوادهٔ مشترک داشته باشند.
- از population بازگشتی خانواده → محصولات → خانواده جلوگیری کن؛ `maxDepth: 0` برای رابطهٔ `family` و خواندن فقط شناسه در مسیرهای مصرف‌کننده کافی است. سازگاری آن با انتخابگر native را در ادمین مشاهده کن.
- توضیح: «برای نمایش گزینه‌های دیگر این محصول، یک خانواده انتخاب کنید. تغییر این فیلد فقط همین محصول را جابه‌جا می‌کند.»
- از فیلترهای brand/category/type برای محدودکردن عضویت استفاده نکن.
- تغییر رابطه در لاگ فعلی `product_update` با شناسهٔ خانوادهٔ قبلی/جدید ثبت شود؛ برای مقدار عددی/آبجکت/null مقایسهٔ نرمال‌شده انجام بده. سیستم audit تازه نساز.

### ۳.۳ تجربهٔ ادمین و تمامیت رابطه

- ایجاد خانواده و انتخاب آن از فرم محصول با کنترل بومی Payload انجام شود.
- صفحهٔ خانواده، اعضای فعلی را با Join نشان دهد و امکان بازکردن فرم عضو برای ویرایش داشته باشد.
- افزودن کالای موجود با انتخاب خانواده در فرم همان کالا انجام می‌شود؛ ویرایش گروهی بومی Products در صورت پشتیبانی field قابل استفاده است. Join را به‌اشتباه دارای انتخابگر افزودن کالای موجود فرض نکن و برای این نسخه یک ویرایشگر عضویت سفارشی نساز.
- تغییر رابطه در عضو، نمایش خانوادهٔ قبلی و جدید را بعد از خواندن مجدد اصلاح می‌کند؛ هیچ hook برای نوشتن در محصولات خواهر لازم نیست.
- collection جدید را داخل همان `protectBusinessRelations` ثبت کن. پیام راهنمای `products.family` را در `referenceActions` اضافه کن.
- خانوادهٔ دارای عضو، حتی عضو غیرفعال، قابل حذف نیست؛ خانوادهٔ خالی قابل حذف است. حذف خانواده نباید محصول را حذف کند یا عضویت را بی‌صدا null کند.
- ثبت collection در MCP مطابق مجموعه‌های کاتالوگ فعلی، با guardهای موجود انجام شود؛ schema محصول باید رابطهٔ جدید را منعکس کند. مجوز کلیدهای موجود را خودکار گسترش نده و bulk-write ممنوع فعلی MCP را دور نزن.

### ۳.۴ migration

یک migration افزایشی جدید با نام زمانی معتبر در `apps/cms/src/migrations/` بساز و در `index.ts` ثبت کن. migrationهای اجراشده و baseline را ویرایش نکن.

- جدول خانواده با id و name و timestamps مطابق adapter نصب‌شده.
- ستون nullable `products.family_id`، ایندکس غیر unique و FK به خانواده با `ON DELETE RESTRICT`.
- تغییرات مربوط به `payload_locked_documents_rels` و سایر روابط سیستمی لازم برای collection جدید را از schema تولیدی adapter استخراج کن؛ صرفاً جدول business را دستی حدس نزن.
- هیچ UPDATE برای name/SKU/price/stock/grade/شناسهٔ محصولات و هیچ عضویت اولیه‌ای ایجاد نکن.
- بعد از migration، تمام محصولات قبلی بدون خانواده‌اند و رفتارشان همان قبلی است.
- تایپ‌های `apps/cms/src/payload-types.ts` و import map را با ابزارهای پروژه تولید کن؛ خروجی generated را دستی اصلاح نکن.
- rehearsal فقط روی DB محلی مجزا/clone مجاز: مقایسهٔ شمارش و digest فیلدهای قبلی، null بودن رابطهٔ تازه، FK/index و تاریخچهٔ migration. rollback schema فقط در DB دورریختنی آزموده شود.

## ۴. قرارداد و API مربوط به Web

### ۴.۱ رکورد مشترک

به `CatalogRecordSchema` فیلد `familyId: number | null | undefined` اضافه کن؛ عدد باید integer مثبت باشد. فیلد optional برای خواندن snapshotهای قدیمی است. خروجی جدید سرور همیشه عدد یا null بدهد. شکل raw رابطهٔ Payload و `family.products` به مرورگر ارسال نشود.

- `productProjection` در `catalog-sync.ts` شامل `family` شود.
- `catalogRecord` مقدار رابطهٔ عددی یا populated را به شناسه تبدیل و `familyId` را صریحاً تولید کند؛ membership فقط از دادهٔ ذخیره‌شده خوانده شود.
- browse، sync، getByIds، getById و scan باید از همین تبدیل استفاده کنند و رابطه را از دست ندهند.
- در `apps/web/src/modules/catalog/product-types.ts` و mapper، `familyId?: number | null` منتقل شود؛ مقدار ناموجود در دادهٔ قدیمی برای نمایش معادل بدون خانواده است.
- هیچ فهرست خواهران داخل هر `CatalogRecord` قرار نده؛ این کار snapshotها را تکراری و بازگشتی می‌کند.

### ۴.۲ procedure خواندن خانواده

در `packages/contract/src/catalog.ts` قرارداد `catalog.family` تعریف کن و در همان تغییر، handler آن را متصل کن تا implementer نیمه‌کاره نماند:

```text
input:  { productId: positive integer }
output: { scopeKey: string, familyId: positive integer | null,
          items: CatalogRecord[] }
```

ورودی فقط شناسهٔ محصول مبدأ است؛ خانواده را از سرور بخوان. handler در `catalog-sync.ts` کنار خواندن‌های مشترک قرار گیرد و از مسیر تجمیع `catalog.ts` در router قابل فراخوانی شود.

ترتیب اجرا:

1. scope و permissions کاربر را با `catalogScope` بگیر.
2. محصول مبدأ را با شرط `isActive` و `allowedCategoryIds` موجود پیدا کن. نبودن/غیرمجاز بودن: `NOT_FOUND`، بدون افشای خانواده. خطای شبکه/DB را به نبودن محصول تبدیل نکن.
3. اگر بدون خانواده است، `familyId: null` و `items: [محصول مبدأ امن]` برگردان؛ رکورد تازه امکان اصلاح کش قدیمی را هم می‌دهد.
4. در غیر این صورت، محصولات دارای همان خانواده را با همان شرط دسترسی بخوان. شروط search، dimension، grade، inStock یا صفحهٔ فعلی کاربر را وارد این query نکن.
5. صفحه‌های داخلی Payload را با limit=100، sort پایدار `name` سپس `id` تا پایان بخوان؛ به صفحهٔ اول یا حد پیش‌فرض Join اکتفا نکن. شناسه‌ها deduplicate و cancellation درخواست رعایت شود. این نسخه pagination جدیدی در UI خانواده ندارد.
6. در batchها از `attachWarehouseStock` و `catalogRecord` فعلی استفاده کن. قیمت یا موجودی را جداگانه محاسبه نکن؛ `hideExactStock`، `hasSupplySource` و صلاحیت فعلی QR حفظ شوند.
7. `items` اعضای قابل مشاهده، شامل مبدأ، است؛ total تعداد اعضای پنهان یا نام خانوادهٔ داخلی برنگردان.

این endpoint تمامیت تراکنشی snapshot جدیدی وعده نمی‌دهد؛ همان مدل تازگی کاتالوگ جاری را دارد. N+1 خواندن قیمت/موجودی برای تک‌تک اعضا نساز.

## ۵. داده و تعامل در Web

### ۵.۱ مالکیت داده و کش

فایل جدید `apps/web/src/modules/catalog/catalog-family.ts`، hook با نام `useCatalogFamily(productId, enabled)`.

- query key در `apps/web/src/lib/query-keys.ts`: namespace خانواده با owner، scopeKey و productId؛ کلید در component ساخته نشود.
- transport خانواده را به coordinator موجود اضافه کن. متد `family` مشابه `browse` دارای کنترل owner/epoch، AbortSignal، شمارهٔ read، foreground و ادغام با `merge` باشد.
- رکوردها در همان `CatalogSnapshot.byId` ادغام شوند. نتیجهٔ query hook فقط metadata شامل `familyId` و IDs نگه دارد؛ store دوم Product نساز.
- reset/changeScope/logout queryهای خانوادهٔ مربوط را reset/remove و پاسخ دیررس را رد کند. شمارنده‌ها در finally آزاد شوند.
- hook دادهٔ قابل نمایش را از IDهای پاسخ و رکوردهای مشترک تازه بسازد. از `products` صفحهٔ فعلی یا خروجی فیلترشدهٔ لیست برای پیداکردن خانواده استفاده نکن.
- query فقط هنگام بازبودن مودال، وجود شناسه، مشخص‌شدن owner و مجاز بودن خواندن شبکه اجرا شود. برای کش قدیمی فاقد `familyId` هم در حالت آنلاین درخواست خانواده مجاز است؛ مقدار کش قدیمی نباید کشف رابطهٔ تازه را متوقف کند.
- `staleTime: 0` و refetch روی بازشدن مودال؛ بدون polling. هنگام refetch، گزینه‌های همان query قابل نگهداری‌اند؛ نتیجهٔ خانوادهٔ قبلی را placeholder خانوادهٔ جدید نکن.
- خطا، خالی بودن و loading متفاوت‌اند. خطای خانواده جزئیات اصلی را مسدود نکند؛ پیام کوتاه و تلاش مجدد در همان بخش باشد.
- پاسخ جدید فهرست اعضا را جایگزین کند؛ عضو حذف‌شده از خانواده در UI نماند، ولی به این علت از کل کش محصولات حذف نشود.

### ۵.۲ آفلاین

- از `useCatalogData` و انتخاب منبع خواندن موجود تبعیت کن؛ یک تشخیص مستقل با `navigator.onLine` نساز.
- بستهٔ جدید به‌واسطهٔ `syncPage`، `familyId` را داخل محصولات دارد؛ index یا دانلود مستقل خانواده نساز.
- در حالت آفلاین، از رکورد مبدأ در بستهٔ متعلق به owner و محصولات همان بسته با `familyId` برابر استفاده کن. null/undefinedها را هم‌خانواده محسوب نکن.
- برای کش آفلاین legacy فقط دادهٔ محلی قابل استفاده است؛ اگر ناقص است ادعای همهٔ اعضا نکن. متن «گزینه‌های ذخیره‌شده» مناسب است.
- snapshot قدیمی فاقد این فیلد همچنان قابل خواندن باشد و بخش خانواده نداشته باشد؛ فقط برای این تغییر format آفلاین را بالا نبر.
- `structuralOfflineData` باید تغییر خانواده را در hash ساختاری حفظ کند؛ فیلد را از digest حذف نکن.
- حالت آفلاین هیچ درخواست شبکهٔ خانواده یا تغییر رفتار سفارش موجود ایجاد نکند.

### ۵.۳ مودال و مالک محصول فعال

فایل جدید `apps/web/src/modules/products/product-bottom-sheet/_product-family-options.tsx` یک جزء نمایشی با props باشد. داده در مسیر catalog و محصول فعال در والد فعلی نگهداری شود.

- prop جدید `onViewProduct: (product: Product) => void` را به مودال بده و هر دو callsite را متصل کن.
- در ProductListView این callback `activeProductId` را به گزینهٔ جدید تغییر دهد. وضعیت انتخاب و callback سفارش/تأمین از همان `activeBottomSheetProduct` جدید مشتق شوند.
- در PlanCard محصول نمایشی عوض شود؛ `isOrderingDisabled=true` و `isSelected=false` همان حالت مشاهده باقی بماند. هم‌خانواده بودن به معنی عضویت در طرح تخفیف نیست.
- مودال، product state مستقل برای انتخاب خانواده نگه ندارد. حفظ `renderedProduct` فقط برای انیمیشن بسته‌شدن مجاز است.
- تغییر گزینه، گالری را با id جدید reset کند و QR/zoom متعلق به قبلی را ببندد؛ focus قابل پیش‌بینی بماند و مودال دوم باز نشود.
- انتخاب گزینه سبد، selectedIds، مقدار، انبار و supply draft را تغییر ندهد. کاربر می‌تواند دو SKU از یک خانواده را جداگانه انتخاب کند؛ انتخاب‌ها در سطح خانواده mutual-exclusive نیستند.
- در مسیر productId URL رفتار فعلی والد حفظ شود؛ لینک ورودی بعد از بستن مودال مطابق مسیر فعلی پاک شود. route جدید نساز.

### ۵.۴ نمایش

- جای بخش: بعد از مشخصات اصلی (`ProductSpecGrid`) و قبل از توضیحات بلند، در هر دو برنامه.
- عنوان «گزینه‌های دیگر این محصول»؛ وقتی تعداد اعضای قابل نمایش کمتر از دو است کل بخش پنهان شود. عضو جاری نیز داخل مجموعه با نشان «در حال مشاهده» مشخص باشد.
- ردیف‌های فشرده با نام کامل، درجه، ابعاد/بسته‌بندی مرتبط، SKU برای رفع ابهام، قیمت و واحد فروش و وضعیت موجودی. فیلد خالی را حدس نزن؛ برای اختلاف لعاب نام و برچسب موجود کافی است.
- در Web دکمهٔ مشاهده با accessible name؛ عضو جاری مشخص و غیرقابل انتخاب مجدد. اطلاعات قیمت/موجودی از مدل امن موجود خوانده شود. مقادیر maskingشدهٔ `hideExactStock` را عدد واقعی نمایش نده.
- ترتیب پایدار نام و سپس id؛ عضو جاری را با هر کلیک به اول لیست نپراند. در دادهٔ آفلاین از comparator ثابت نام و id استفاده کن؛ ترتیب تجاری درجه اختراع نکن.
- گزینهٔ ناموجود اگر قابل انتشار/مشاهده است غیرفعال نشود؛ مشاهدهٔ آن همچنان ممکن است.
- همان tokens، فونت، formatting helpers، جهت RTL و logical spacing؛ SKU در `bdi` یا محدودهٔ LTR. نام بلند wrap شود و کنترل‌ها نام قابل دسترس داشته باشند.
- انتخابگرهای جداگانهٔ رنگ/درجه/لعاب یا تصویر تازه برای گزینه‌ها نساز. این نسخه ردیف‌های متنی دارد و به سیاست watermark تصویر جدیدی اضافه نمی‌کند.

## ۶. کاتالوگ عمومی: همان خانواده، سیاست مستقل

### ۶.۱ قرارداد عمومی و سازگاری انتشار

مسیر عمومی همچنان Catalog → SDK سروری → CMS است؛ commerce API و دادهٔ Web در آن دخالت ندارند.

در `packages/contract/src/public-catalog.ts`:

- `PublicCatalogFamilyOptionSchema` را با `pick` از `PublicCatalogProductSchema` بساز، شامل `id`, `name`, `sku`, `productType`, `brand`, `dimension`, `color`, `grade`, `tags`, `width`, `height`, `unit`, `weight`, `itemsPerPack`, `price`, `stock`. تایپ از schema مشتق شود.
- به ورودی عملیات `product` فیلد اختیاری `includeFamilyOptions: boolean` اضافه کن.
- به خروجی همان عملیات `familyOptions?: PublicCatalogFamilyOption[]` اضافه کن؛ بدون default در schema خروجی.
- وقتی درخواست flag ندارد یا false است، CMS این property را اصلاً نفرستد. خروجی strict نسخهٔ قدیمی Catalog با اضافه‌شدن بدون شرط یک کلید می‌شکند؛ `.default([])` روی این property در سمت خروجی سرور ممنوع است.
- وقتی flag=true است، CMS حتماً array بدهد: بدون خانواده `[]`، خانوادهٔ تک‌عضوی یک گزینه، خانوادهٔ چندعضوی گزینه‌های مجاز شامل جاری. UI در کمتر از دو عضو پنهان می‌شود.
- frontend جدید در `getProduct` با flag=true بخواند؛ CMS سازگار باید پیش از Catalog جدید منتشر شود. UI برای فقدان property نیز `[]` در نظر بگیرد، بدون استفاده از fallback برای پنهان‌کردن خطای HTTP.
- DTO محصول عمومی، browse و bootstrap را با familyId، نام داخلی خانواده یا اعضای بازگشتی بزرگ نکن. عملیات HTTP عمومی جدیدی لازم نیست.

### ۶.۲ خواندن در CMS

عملیات `product` در `createCatalogService` این ترتیب را داشته باشد:

1. settings را فقط یک‌بار برای کل پاسخ بگیرد؛ محصول مبدأ از query فعلی با `compilePolicy(settings)` عبور کند. pause، حذف، exclusion یا عدم انتشار همان `CATALOG_NOT_FOUND` فعلی است.
2. فقط پس از مجازشدن مبدأ و درخواست flag، `family` آن را با خواندن محدود `depth: 0`, `req`, `overrideAccess: false` به دست آورد. خانواده به caller خام نشان داده نشود.
3. به `CatalogQuery` داخلی فیلد `familyId?: number` اضافه کن. در `catalogQuerySQL` شرط پارامتری `p.family_id = ...` با AND کنار شرط نهایی انتشار اعمال شود؛ از interpolation شناسه و تغییر سیاست عمومی خودداری کن. این فیلد ورودی آزاد مرورگر نیست.
4. query خانواده با همان `compilePolicy(settings)`، بدون `applyVisitorFilters` و بدون `productId` مبدأ اجرا شود. محدودیت خانواده بعد از `(added OR baseMatches)` و همراه active/exclusion اعمال شود؛ additions نباید محصولات خانواده‌های دیگر را وارد کند.
5. صفحه‌های داخلی ۱۰۰تایی با sort=`default` تا پایان `total` خوانده، deduplicate و batch hydrate شوند. توقف پیشرفت غیرعادی خطا باشد؛ خروجی کامل را بی‌صدا truncate نکن.
6. اعضا از همان `hydrate` و `mapPublicProduct` فعلی عبور کنند؛ سپس فیلدهای option صریحاً انتخاب و schema option parse شود. raw Product، row SQL یا آبجکت commerce به DTO عمومی spread نشود.
7. خطای خواندن خانواده در پاسخ opt-in، خطای واقعی سرویس باقی بماند و به array خالی تبدیل نشود؛ سیاست فعلی عدم جعل موفقیت حفظ شود.

اگر برای قابل آزمون‌شدن orchestration نیاز به استخراج helper داری، فقط helper محلی همین ماژول با ورودی مشخص بساز؛ framework repository/service یا موتور policy دوم ایجاد نکن.

### ۶.۳ الزامات قیمت، موجودی و انتشار

- قیمت `hidden`: نه amount در JSON، نه قیمت/واحد قیمت در DOM، title یا aria-label.
- قیمت `unpriced`: همان متن اعلام‌نشدن قیمت؛ صفر یا قیمت Web جایگزین نشود.
- قیمت `amount`: همان فرمول درصد/گردکردن سیاست عمومی در mapper فعلی و با واحد فروش عضو.
- موجودی `hidden`: نه عدد، نه status و نه نشان موجود/ناموجود در UI یا metadata.
- موجودی `status`: فقط وضعیت مجاز؛ عدد واقعی ندارد.
- موجودی `numeric`: quantity محدودشده و capped موجود؛ جمع انبارها یا دسترسی به مقدار پنهان ممنوع.
- سیاست عمومی می‌تواند عضو ناموجود را حذف کند؛ عضویت خانواده آن را برنمی‌گرداند. اگر policy اجازه دهد، ناموجود با وضعیت مجاز نمایش داده می‌شود.
- مخفی‌کردن قیمت/موجودی به معنی نادیده‌گرفتن criteria مدیریتی انتشار نیست؛ compilePolicy همان مرجع باقی می‌ماند.
- هیچ total یا شناسه‌ای از اعضای منتشرنشده، اطلاعات انبار، scan code، قیمت پایه یا نام داخلی خانواده منتشر نشود.

### ۶.۴ صفحهٔ عمومی

فایل جدید `apps/catalog/src/modules/product/_product-family-options.tsx`، جزء نمایشی مستقل Catalog.

- `ProductView` گزینه‌ها را از پاسخ همان `product` بگیرد و به component بدهد؛ fetch جدا در مرورگر لازم نیست.
- عضوهای دیگر لینک واقعی `/p/{id}` داشته باشند و URL/عنوان/اشتراک‌گذاری با رفتن به محصول جدید عوض شود؛ عضو جاری با `aria-current` مناسب مشخص شود.
- برای این لینک‌های فرعی prefetch گسترده فعال نکن. همان back-to-catalog و رفتار مسیر مستقل فعلی حفظ شود.
- برای وضعیت و formatting از helpers همین برنامه استفاده کن. اگر `ProductValues` بازاستفاده شد، props آن را به حداقل `Pick` لازم از مدل عمومی محدود کن؛ option را با cast به محصول کامل تبدیل نکن.
- بخش از منطق selection/order Web چیزی import نکند. هیچ کنترل خرید، لینک Web یا ادعای تخفیف طرح اضافه نشود.
- ISR ۳۰۰ثانیه‌ای و مسیر cache محصول باقی بمانند؛ flag در بدنهٔ درخواست جدید، کلید خواندن را از دادهٔ قدیمی متمایز می‌کند. حذف/انتقال خانواده هم مثل دیگر تغییرات محصول فوراً در همهٔ صفحات cacheشده تضمین نمی‌شود. Webhook، purge یا polling جدید نساز.
- متادیتای اشتراک‌گذاری، noindex و عدم درج قیمت/موجودی در metadata حفظ شود.

## ۷. ترتیب اجرای قابل بررسی

پیش‌پرواز: `AGENTS.md`های جاری، diff کاربر و نسخه‌های نصب‌شده را بخوان. ابتدا baseline مرتبط را بررسی کن. مهارت‌های payload، orpc/orpc-contract، nexload-code، nexload-react، tanstack-query، rtl-persian-ui و مهارت‌های UI مربوط به فایل‌های در حال تغییر را به‌تناسب بارگذاری کن. پیش از کدنویسی Next راهنمای محلی نسخهٔ نصب‌شده و پیش از مصرف API HeroUI مستندات/MCP آن را بررسی کن.

| مرحله | کار | نقطهٔ بررسی |
| --- | --- | --- |
| ۱ | Collection، رابطه، محافظ حذف، MCP، migration و تایپ‌های generated | CMS typecheck، unitهای مرتبط، rehearsal migration و ادمین محلی |
| ۲ | `familyId`، projection/mapper، قرارداد و handler خانواده در یک تغییر قابل کامپایل | API typecheck/test، پاسخ مجاز/غیرمجاز و تمام صفحات |
| ۳ | coordinator، hook، آفلاین و wiring دو مودال | Web typecheck/test/build، آزمون دستی تغییر گزینه/انتخاب |
| ۴ | قرارداد opt-in عمومی، query خانواده و mapper امن در CMS | تست قرارداد/سیاست/سرویس، query واقعی PostgreSQL |
| ۵ | خواندن opt-in و component صفحهٔ Catalog | Catalog typecheck/test/build، مشاهدهٔ سیاست‌ها و لینک‌ها |
| ۶ | docs، تست‌های ثبت‌شده و گزارش اجرای واقعی | check:deps و check نهایی مرتبط، مرور diff |

بعد از هر مرحله کد قابل کامپایل بماند. اگر افزودن متد به Transport fixtureهای تست را نیازمند تغییر کرد، همان مرحله به‌روزشان کن. خروجی schema/handler یا مصرف‌کنندهٔ آن را نیمه‌کاره رها نکن.

دستورهای موجود و مجاز از ریشه:

```bash
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm --filter @persianpart/cms exec tsc --noEmit
pnpm --filter @persianpart/cms test:unit
pnpm --filter @persianpart/api typecheck
pnpm --filter @persianpart/api test
pnpm --filter @persianpart/web exec tsc --noEmit
pnpm --filter @persianpart/web test:unit
pnpm --filter @persianpart/web build
pnpm --filter @persianpart/catalog typecheck
pnpm --filter @persianpart/catalog test
pnpm --filter @persianpart/catalog build
pnpm check:deps
pnpm check-types
pnpm test:unit
pnpm build
```

این بلوک فهرست فرمان‌هاست، نه دستور اجرای همهٔ آن‌ها پس از هر ویرایش. از narrow check شروع کن و در پایان چهار workspace متأثر را یک‌بار تأیید کن؛ check کاملِ پاس‌شده را بدون تغییر تازه تکرار نکن. CMS unit script فایل‌ها را صریح فهرست می‌کند؛ تست جدید فقط با ساختن فایل وارد suite نمی‌شود و باید در script ثبت شود.

دستورهای migration با `pnpm --filter @persianpart/cms migrate:create` و `migrate` فقط پس از احراز مقصد محلی مجزا اجرا شوند؛ متغیرهای `.env` را چاپ نکن و از `migrate:fresh` روی پایگاه موجود استفاده نکن.

## ۸. معیارهای پذیرش و آزمون‌ها

fixtureهای ساختگی محلی: خانوادهٔ F با A/B/C؛ خانوادهٔ G با D؛ U بدون خانواده. A فعال و قابل نمایش، B فعال با درجه/رنگ/اندازهٔ متفاوت، C غیرفعال. برای آزمون عمومی دو عضو فعال دیگر با exclusion و عدم تطبیق criteria بساز. شناسه‌های تولید را استفاده نکن.

| سناریو | نتیجهٔ لازم | شاهد |
| --- | --- | --- |
| اتصال A به F و سپس G | A فقط در G؛ B در F باقی بماند | خواندن DB/CMS و ادمین |
| خانوادهٔ خالی و دارای عضو | حذف خالی موفق؛ حذف F با عضو حتی غیرفعال رد | CMS + FK واقعی |
| نام تکراری محصول/خانواده | هویت با id، بدون ادغام خودکار | unit/خواندن محلی |
| دادهٔ قبلی پس از migration | تمام رکوردها و فیلدهای قدیمی حفظ، family خالی | count/digest و schema inspection |
| کاربر محدود به دستهٔ A | عضو خارج دسته در پاسخ خانواده نیاید | تست handler و درخواست محلی |
| مبدأ پنهان/غیرفعال | NOT_FOUND بدون افشای اعضا | تست handler |
| خطای CMS/DB | failure واقعی؛ موفقیت خالی جعل نشود | تست خطا |
| خانواده بیش از ۱۰۰ عضو | صفحات بعدی هم خوانده شوند | unit orchestration و نمونهٔ محلی |
| جست‌وجوی صفحه فقط A را یافته | B همچنان در خانواده قابل مشاهده | آزمون دستی Web |
| پاسخ کند خانواده پس از تغییر حساب/scope | دادهٔ حساب قبلی merge/render نشود | coordinator unit با promise کنترل‌شده |
| پاسخ کند قدیمی پس از targeted read جدید | رکورد جدید عقب‌گرد نکند | coordinator unit |
| انتقال B در سرور و بازکردن مجدد مودال | لیست تازه B را از F بردارد | آزمون refresh |
| کلیک سریع A→B→A | متن/قیمت/گالری/QR/action همگی متعلق به فعال | مشاهدهٔ مرورگر |
| انتخاب A در خرید، سپس مشاهدهٔ B | انتخاب A حفظ؛ اقدام انتخاب B روی B انجام شود | مشاهدهٔ state/درخواست |
| مودال از PlanCard | تغییر گزینه مجاز؛ خرید همچنان غیرفعال؛ طرح به B تعمیم نیابد | مشاهدهٔ مرورگر |
| بستهٔ جدید/قدیمی آفلاین | جدید فقط اعضای بسته؛ قدیمی بدون خطا؛ هیچ fetch خانواده | unit + مرورگر آفلاین |
| خانواده در hash آفلاین تغییر کند | نسخهٔ ساختاری تغییر را ببیند | unit با دادهٔ قبل/بعد |
| خانوادهٔ عمومی با exclusions/additions | فقط عضو منتشرشدهٔ همان خانواده؛ addition غیرعضو وارد نشود | policy/service test + PostgreSQL |
| قیمت عمومی hidden/amount/unpriced | schema و DOM دقیقاً حالت مجاز را نشان دهند | mapper/contract test + مرورگر |
| موجودی عمومی hidden/status/numeric capped | هیچ مقدار ممنوع در JSON/DOM/aria نباشد | mapper/contract test + مرورگر |
| مبدأ عمومی 404 یا pause | درخواست family راه دورزدن ایجاد نکند | HTTP محلی |
| درخواست قدیمی product بدون flag | JSON فاقد familyOptions و پذیرفتنی برای schema قدیمی | compatibility test |
| درخواست جدید با flag | array معتبر؛ لینک گزینه به صفحهٔ همان SKU | contract test + مرورگر |
| محصول بدون خانواده یا تک‌عضو قابل نمایش | بخش گزینه‌ها پنهان | هر دو UI |
| ۳۷۵px، دسکتاپ، نام بلند و صفحه‌کلید | overflow افقی ندارد؛ focus و bidi و نام کنترل درست | مشاهدهٔ هر دو UI |
| metadata عمومی | همچنان noindex؛ بدون نشت قیمت/موجودی گزینه‌ها | تست موجود + مشاهدهٔ HTML |

تست‌ها رفتار واقعی و مرز دسترسی را بسنجند؛ تست متن منبع یا صرفاً برابر بودن config ننویس. برای query جدید، بررسی SQL تولیدی به‌تنهایی اثبات عملکرد PostgreSQL نیست. تست‌های دائمی مطابق تصمیم پروژه unit و بدون سرویس خارجی باشند؛ rehearsal DB و مرورگر به‌صورت بررسی محلی ثبت شود، نه افزودن harness سراسری E2E.

## ۹. مستندسازی، انتشار و بازگشت

- `docs/11-product-creation-standards.md`: توضیح اختیاری‌بودن خانواده، عضویت دستی و تک‌مقداری؛ استاندارد نام/رنگ/درجه تغییر نکند.
- `docs/12-public-catalog.md`: گزینه‌های خانواده، سیاست هر عضو، flag سازگاری و تازگی ISR مستند شود.
- مرحلهٔ آماده‌سازی schema/CMS، سپس API و سپس Web/Catalog؛ CMS قدیمی ورودی strict دارای flag جدید را نمی‌پذیرد. عملیات قدیمی بدون flag بعد از CMS جدید باید همچنان کار کند.
- feature با خانوادهٔ خالی قابل انتشار است؛ ساخت خانواده‌های واقعی کار جداگانهٔ مدیر است.
- rollback عملیاتی با نسخهٔ برنامه انجام شود و schema افزایشی و membershipها حفظ شوند؛ migration down می‌تواند دادهٔ خانواده‌ها را از بین ببرد و دستور rollback تولید نیست.
- مشترک‌کردن سیاست انتشار Web و Catalog یا بازکردن raw products برای anonymous راه‌حل هیچ خطایی نیست.

گزارش آینده در `.agents/brain/product-families-execution-report.md` شامل commit مبنا، فایل‌های تغییرکرده، فرمان و نتیجهٔ واقعی checks، شواهد migration/UI، و موارد اجرا‌نشده باشد. عبور typecheck را معادل تأیید DB، ACL، ادمین یا مرورگر گزارش نکن. اگر محیط بررسی موجود نبود، همان مورد را `[UNKNOWN]` بنویس؛ باقی کار مجاز را کامل کن.

## ۱۰. تحویل به اجراکننده

```text
[NEXLOAD HANDOFF]
From: nexload-reasoning / معماری تأییدشده در گفتگو
To: nexload-reasoning-execution
Context Pointer: .agents/brain/product-families-implementation-plan.md @ 52219a4
Established Facts:
- محصولات موجود مستقل‌اند و در نام/درجه/اندازه تکرار دارند؛ عضویت دستی است.
- Web از کش مشترک و بستهٔ آفلاین استفاده می‌کند؛ مودال دو callsite دارد.
- CMS مرجع سیاست عمومی است؛ Catalog به commerce API متصل نیست.
Hard Constraints:
- عضویت صفر یا یک؛ انتقال فقط همان محصول؛ عدم تغییر ماهیت SKU/سفارش/موجودی.
- رعایت ACL و سیاست انتشار/قیمت/موجودی برای هر عضو.
- scope این گفتگو تهیهٔ پلن بود؛ اجرای آینده نیازمند دستور اجراست.
Settled Decisions:
- product-families + products.family، Join معکوس بدون ذخیرهٔ دوباره.
- نمایش در هر دو برنامه، آفلاین از بستهٔ موجود و بدون auto-grouping.
Next Cognitive Objective:
- پس از دستور اجرا، مراحل ۱ تا ۶ را به‌ترتیب بساز و معیارهای پذیرش را مشاهده کن.
[END HANDOFF]
```
