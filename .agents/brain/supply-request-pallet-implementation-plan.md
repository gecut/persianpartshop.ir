# پلن اجرایی درخواست تأمین و نمایش پالت

تاریخ: ۲۰۲۶-۱۱-۰۸ — مبنای بررسی کد: `ad2fe63`

وضعیت: سند تاریخی پلن مصوب است؛ برای نتیجه اجرا و بررسی‌ها گزارش اجرای همراه را ببینید. بنا بر دستور بعدی کاربر، تاریخچه migration بازنشانی و یک baseline تازه ساخته شد؛ دستورهای migration افزایشی این سند در این بخش جایگزین شده‌اند. baseline تازه برای پایگاه خالی است و به‌تنهایی مسیر حفظ دادهٔ پایگاه موجود نیست.

مخاطب: مدل اجراکننده‌ای که به این مکالمه دسترسی ندارد. این سند را به‌ترتیب اجرا کن؛ تصمیم کسب‌وکار تازه نگیر و قابلیت خارج دامنه اضافه نکن.

مرجع پاسخ‌های صریح کاربر: [سابقه کشف نیازمندی](supply-request-pallet-discovery.md). تصمیم جاری این سند بر پیشنهادها و پاسخ‌های منسوخ در آن فایل تقدم دارد.

## ۱. نتیجه مورد انتظار و مرز دامنه

مشتری در همان صفحه محصولات بین «خرید از موجودی» و «درخواست تأمین» انتخاب می‌کند. درخواست تأمین دقیقاً یک محصول و یک انبار استعلامی دارد. فقط محصول دارای منبع تأمین فعال و فقط مقداری که یک انبار قطعی فعال نتواند به‌تنهایی تأمین کند قابل درخواست است. درخواست، خرید یا رزرو نیست. مجموعه وضعیت را در CMS تغییر می‌دهد و از آن به بعد ارتباط و هماهنگی با مشتری خارج سامانه است.

پالت فقط نمایش معادل تعداد کارتن است. ورودی و محاسبات خرید تغییر ماهیت نمی‌دهند؛ هیچ مقدار به پالت کامل گرد نمی‌شود.

### تصمیم‌های الزام‌آور کاربر

| موضوع | تصمیم نهایی |
|---|---|
| نوع انبار | هر انبار کاملاً قطعی یا کاملاً استعلامی؛ حالت ترکیبی برای یک انبار نداریم. |
| منبع | رابطه فعال محصول با یک انبار استعلامی فعال؛ مدیریت دستی در CMS. |
| شکل درخواست | یک محصول × یک انبار؛ چند منبع برای یک محصول ممنوع نشده، ولی حالت معمول یک منبع است. |
| صلاحیت مقدار | فقط اگر هیچ انبار قطعی فعال به‌تنهایی مقدار گرد‌شده لازم را ندارد؛ جمع موجودی چند انبار ممنوع. |
| موجودی کافی هنگام ثبت | درخواست رد شود؛ مسیر خرید پیشنهاد و فرم حفظ شود؛ سفارش خودکار ساخته نشود. |
| پیش‌نویس | یک پیش‌نویس تأمین مستقل از خرید؛ جایگزینی محصول/انبار با تأیید. |
| ویرایش پس از ثبت | محصول، مقدار، انبار، یادداشت و برآورد ثبت‌شده تغییر نکنند. |
| وضعیت | ثبت‌شده، در حال بررسی، تأمین شده، غیرقابل تأمین، لغو توسط مشتری. |
| لغو | فقط پیش از شروع بررسی؛ پس از شروع بررسی مشتری حق لغو ندارد. |
| اصلاح مدیریت | ویرایش ساده وضعیت توسط نقش‌های مجاز؛ بدون فرایند ویژه یا دلیل اجباری. |
| تکرار عمدی | چند درخواست باز مجاز؛ فقط تکرار فنی همان ثبت مهار شود. |
| مهلت | ۴۸ ساعت پیوسته از ثبت سرور؛ سررسید، درخواست را خودکار نمی‌بندد. |
| اطلاع‌رسانی | تأیید ثبت در سایت؛ پیامک هنگام نتیجه نهایی؛ جزئیات در حساب مشتری. |
| قیمت | برآورد جاری حساب هنگام ثبت ذخیره شود؛ قیمت قطعی نیست؛ تأیید مجدد تغییرات لازم نیست. |
| کالا | کاشی و سایر کالاها با واحد فروش فعلی؛ پالت فقط کاشی. |
| توضیح | فقط یادداشت اختیاری مشتری؛ مدیریت فقط وضعیت را تغییر می‌دهد. |
| دسترسی مشتری | همان مجوز خرید فعلی، شامل فعال‌بودن و دسته‌بندی؛ حساب فقط‌کاتالوگ حق ثبت ندارد. |
| دسترسی کارکنان | مدیر ارشد/مدیر/پشتیبانی وضعیت را تغییر دهند؛ منابع فقط مدیر ارشد/مدیر. |
| پالت | ضریب اختیاری، نمایش در خرید و تأمین؛ نبود ضریب رفتار کارتن را حفظ کند. |

### خارج دامنه قطعی

- درخواست چندمحصولی، سبد مخلوط خرید/تأمین، تقسیم مقدار میان انبارها، رزرو موجودی استعلامی.
- پرداخت، ارسال، حواله تأمین، پیشنهاد جزئی، مقدار پاسخ، قبول پیشنهاد و تبدیل خودکار درخواست به سفارش.
- اجبار پالتی، تنظیم سیاست پالتی، ورودی مستقل سفارش بر مبنای پالت.
- انقضای منبع، تعطیلات و ساعت کاری، انقضای خودکار درخواست، CSV منابع استعلامی.
- پیام‌رسان داخلی، توضیح نتیجه، علت اصلاح اجباری، گردش تأیید اصلاح، تاریخچه اختصاصی تغییرات وضعیت.
- سبد سروری، پیش‌نویس بین‌دستگاهی، چارچوب عمومی گردش کار، صف پیام جدید و وابستگی جدید.
- reset، بازنویسی baseline، اجرای migration روی دیتابیس واقعی، انتشار یا ارسال پیامک واقعی در تست.

## ۲. شواهد موجود و اصلاح برداشت‌های قبلی

این‌ها مشاهده کد هستند، نه اثبات عملکرد runtime:

| مسیر | مشاهده و پیامد |
|---|---|
| `apps/web/src/routes/product.tsx` | فقط layout و Outlet است؛ صفحه اصلی محصولات در `routes/product/index.tsx` است. |
| `features/products/selection-store.ts` | افزودن کالا به خرید نیازمند availability و انبار قادر به تأمین کل سبد است؛ درخواست تأمین را وارد این store نکن. |
| `features/products/order-entry-modal.tsx` | الگوی بصری تعیین مقدار است، اما در بررسی فعلی مصرف‌کننده‌ای برای آن پیدا نشد؛ تغییر این فایل به‌تنهایی قابلیت را فعال نمی‌کند. |
| `features/products/product-config-card.tsx` | مقدار به موجودی عددی clamp می‌شود؛ آن را مستقیماً برای تأمین استفاده نکن. |
| `apps/api/src/routers/warehouse-stock.helpers.ts` | موجودی کاتالوگ بیشترین balance یک انبار فعال است، نه جمع انبارها؛ نوع قطعی باید به query اضافه شود. |
| `apps/api/src/routers/warehouse.ts` | انبارهای واجد شرایط کل سبد را پیدا می‌کند؛ استعلامی‌ها باید از این مسیر خارج باشند. |
| `apps/cms/src/collections/orders/_apply-reservation.before-change.ts` | ایجاد سفارش رزرو و لغو آن restore می‌کند؛ هیچ درخواست تأمینی وارد این hooks نشود. |
| `warehouse-stock/_import.endpoints.ts` و `_stock-operations.ts` | مسیرهای کنترل‌شده ورود/اصلاح/رزرو موجودی‌اند؛ نوع انبار در سرور هم کنترل شود. |
| `apps/api/src/rpc/base.ts` | `customerOnly` موجود است؛ فقط `authed` مانع برخورد هویت admin/customer نمی‌شود. |
| `apps/cms/src/sdk.ts` | API با حساب service به CMS وصل می‌شود؛ شناسه مشتری از context معتبر API گرفته شود، نه body مرورگر. |
| `apps/cms/src/migrations/index.ts` | اکنون فقط baseline به نام `20261107_174631_baseline` ثبت است؛ سندهای قدیمی migration QR مرجع زنجیره جاری نیستند. |
| `apps/cms/src/_schema-inspect.test.ts` | تعداد migration را برابر ۱ فرض کرده؛ با migration افزایشی باید درست به‌روز شود. |
| `apps/web/package.json` | Playwright و `test:pwa` موجودند؛ ادعای نبود هر نوع تست وب در اسناد قدیمی دقیق نیست. runner جدید نصب نکن. |
| `apps/cms/src/lib/sms.ts` و `collections/plans/plans.collection.ts` | helper و الگوی ارسال پیامک موجودند؛ موفقیت تحویل پیامک را تضمین نمی‌کنند. |

پیش از اجرا HEAD و وضعیت فایل‌ها را دوباره بخوان؛ اگر جابه‌جایی مسیر رخ داده، معادل همان مسئولیت را پیدا کن. تصمیم‌های این سند را به خاطر تفاوت نام فایل باز نکن.

## ۳. طرح انتخاب‌شده و دلیل محدودبودن تغییرات

دو collection مستقل `supply-sources` و `supply-requests` اضافه کن. `warehouse-stock` برای موجودی قطعی باقی بماند؛ آن را nullable یا چندمعنایی نکن. به انبار نوع اضافه کن و به محصول ضریب پالت. به آیتم سفارش فقط snapshot اختیاری ضریب پالت اضافه شود، بدون تغییر مبلغ یا رزرو.

ظاهر مودال مقدار و کارت تاریخچه موجود بازاستفاده شود؛ درخواست از یک مودال مستقل ثبت شود و تاریخچه در تب همان `/orders` دیده شود. سبد قطعی، قرارداد submit سفارش و routeهای خرید برای پشتیبانی تأمین دوحالته نشوند.

انتخاب‌های فنی زیر تصمیم طراحی این پلن هستند، نه پاسخ مستقیم کاربر: نام فیلدها، نمایش تاریخ منبع فقط در مدیریت، نام انبار برای مشتری، محدودیت طول یادداشت، روش idempotency، و ارسال پیامک به‌شکل best effort. هیچ‌کدام اجازه افزودن گردش کار تازه نیست.

## ۴. مدل داده دقیق

### ۴.۱ Warehouses

- فیلد `stockMode: 'exact' | 'inquiry'`، required، پیش‌فرض `exact`، عنوان «نوع موجودی».
- تمام انبارهای موجود با migration مقدار `exact` بگیرند؛ از روی نام یا موجودی صفر نوع را حدس نزن.
- مدیر ارشد/مدیر نوع را تعیین کنند. service فقط خواندن لازم برای API داشته باشد.
- بعد از ایجاد هر reference در balance، source، order یا supply-request، تغییر نوع ممنوع باشد؛ پیام روشن بده که انبار جدید بسازند و قدیمی را غیرفعال کنند. تغییر نوع انبار بدون reference مجاز است.
- در نوشتن referenceهای جدید، نوع انبار در همان تراکنش و با قفل اشتراکی ردیف انبار بررسی شود؛ تغییر stockMode ردیف را قفل و نبود reference را دوباره بررسی کند تا create همزمان قاعده نوع را دور نزند. همان الگوی lock انبار در مسیر سفارش/رزرو فعلی کافی است؛ قفل سراسری نساز.
- غیرفعال‌سازی روی تاریخچه یا امکان تعیین وضعیت درخواست‌های قبلی اثر نگذارد.

### ۴.۲ Products

- `cartonsPerPallet?: number | null`: عدد صحیح مثبت اختیاری، فقط برای tile در CMS نمایش داده شود، نوشتن مدیر ارشد/مدیر.
- خالی یعنی ضریب نداریم؛ صفر، منفی، اعشار و مقدار ناامن رد شوند. برای `other` مقدار مؤثر همیشه null باشد؛ داده پنهان قدیمی وارد محاسبه نشود.
- `sqmPerPallet`، تعداد پالت موجودی یا قیمت پالت ذخیره نکن؛ مشتق‌شده‌اند.

### ۴.۳ SupplySources

slug: `supply-sources`، عنوان «منابع تأمین»، گروه کاتالوگ و انبارداری.

| فیلد | قاعده |
|---|---|
| `product` | رابطه required به products، index |
| `warehouse` | رابطه required به warehouses، index؛ فقط inquiry |
| `isActive` | required، پیش‌فرض true |
| `lastReportedAt` | تاریخ required، پیش‌فرض زمان ثبت، قابل تنظیم توسط مدیر؛ عنوان صریح «تاریخ آخرین گزارش حضور کالا» |
| timestamps | createdAt و updatedAt معمول Payload |

- unique DB روی `(warehouse, product)`؛ چند انبار برای یک محصول مجاز است، منبع تکراری نه.
- در CMS فیلتر انتخاب انبار فقط inquiry باشد؛ hook هم همین قاعده را enforce کند.
- خواندن: مدیر ارشد/مدیر/service؛ نوشتن: مدیر ارشد/مدیر؛ پشتیبانی برای تغییر منبع مجاز نیست.
- حذف ممنوع؛ غیرفعال‌سازی و فعال‌سازی مجدد. محصول و انبار رکورد پس از ایجاد تغییر نکنند.
- source واجد شرایط = خودش فعال + انبار فعال inquiry + محصول فعال و مجاز برای مشتری.
- تاریخ منبع TTL ندارد؛ ویرایش خودکار تاریخ در هر save انجام نشود.
- هیچ عدد موجودی یا قیمت در این collection وجود نداشته باشد.

### ۴.۴ SupplyRequests

slug: `supply-requests`، عنوان «درخواست‌های تأمین»، گروه فروش و مشتریان. collection عملیاتی است؛ Payload drafts/versions یا publish workflow فعال نکن.

| فیلد | قاعده |
|---|---|
| `requestNumber` | متن unique تولید سرور، مثلاً `SPR-` + UUID؛ مستقل از شماره فاکتور |
| `user`, `product`, `warehouse` | روابط required و index؛ فقط یک محصول و یک انبار |
| `status` | enum پنج‌حالته بخش ۶، پیش‌فرض new |
| `requestedQuantity` | مقدار اصل تقاضا، finite، مثبت، حداکثر ۱٬۰۰۰٬۰۰۰ و حداکثر دو رقم اعشار |
| `packageCount` | تعداد صحیح بسته/واحد فروش بعد از گردکردن، تولید سرور |
| `roundedQuantity` | مقدار متناظر با بسته کامل، تولید سرور؛ تعهد تحویل نیست |
| `salesFactor` | snapshot متراژ کارتن برای tile و ۱ برای other |
| `productType`, `unit` | snapshot؛ tile=m2، other واحد فروش فعلی |
| `cartonsPerPallet` | snapshot اختیاری ضریب، فقط tile |
| `estimatedUnitPrice`, `estimatedTotal` | snapshot قیمت حساب و برآورد مبلغ؛ اعداد نامنفی صحیح امن |
| `productSku`, `productName`, `productImage` | snapshot نمایشی؛ تصویر URL یا null، اطلاعات فعلی محصول جانشین تاریخچه نشود |
| `warehouseName`, `warehouseCode` | snapshot نام و کد انبار |
| `notes` | فقط یادداشت مشتری، trim، حداکثر ۲۰۰۰ نویسه، پیش‌فرض رشته خالی |
| `responseDueAt` | createdAt سرور + ۴۸ ساعت؛ هنگام ایجاد محاسبه و ثابت بماند |
| `reviewStartedAt` | زمان اولین خروج توسط مدیریت از new؛ sticky، هرگز پاک نشود |
| `resolvedAt` | زمان آخرین تغییر به نتیجه؛ در بازگشت مدیریت به حالت باز null شود |
| `cancelledAt` | فقط هنگام لغو مشتری |
| `idempotencyKey` | hash از شناسه مشتری و UUID درخواست، unique و hidden |
| `requestFingerprint` | hash ورودی canonical شامل productId, warehouseId, requestedQuantity, notes؛ hidden |
| timestamps | معمول Payload |

- user/product/warehouse، ورودی‌ها، snapshotها، مهلت و کلیدها پس از ایجاد immutable؛ برابری رابطه را بر اساس ID بسنج، نه object/stringify populateشده.
- درخواست هرگز balance ایجاد/کسر/restore نکند. نتیجه «تأمین شده» موجودی را تغییر ندهد.
- ایجاد مستقیم دستی در CMS در این فاز لازم نیست؛ create فقط service، با اعتبارسنجی کامل مشتری و داده در CMS.
- ایجاد فقط با وضعیت new مجاز است؛ status نهایی، reviewStartedAt/resolvedAt/cancelledAt یا responseDueAt ارسالی حتی از مسیر service قابل تزریق نیستند. hook زمان‌های معتبر را از زمان سرور تولید کند.
- read: مدیر ارشد/مدیر/پشتیبانی/service. update: این کارکنان برای status؛ service فقط برای لغو کنترل‌شده مشتری. delete: false.
- readOnly بودن فیلد UI امنیت نیست؛ تغییر تمام فیلدهای immutable و زمان‌های سرور در hook هم رد شود.
- هیچ فیلد `responseQuantity`، `responseNotes`، `correctionReason` یا آرایه timeline اضافه نکن.

## ۵. محاسبه، قیمت و صلاحیت

### مقدار کاشی

محاسبه decimal-safe بر اساس صدم متر انجام شود؛ فقط مقدار ورودی معتبر دو رقم اعشار و salesFactor معتبر دو رقم اعشار پذیرفته شوند:

```text
requested100 = round(requestedQuantity × 100)
factor100 = round(sqmPerCarton × 100)
packageCount = ceil(requested100 / factor100)
roundedQuantity = packageCount × factor100 / 100
estimatedUnitPrice = round(basePricePerSqm × (1 + markupPercent / 100))
estimatedTotal = round(roundedQuantity × estimatedUnitPrice)
```

همه مقادیر نهایی finite و در محدوده safe integer مربوط باشند. تولید snapshot در CMS مرجع نهایی است؛ preview API از همان helper عددی استفاده کند. helper باریک را به export موجود `@persianpart/cms/inventory` اضافه کن؛ بسته یا لایه عمومی جدید لازم نیست. این کار بهانه تغییر محاسبه مبالغ خرید فعلی نیست.

### سایر کالاها

همان مدل فعلی `getSalesFactor(other) = 1` حفظ شود: `packageCount = ceil(requestedQuantity)` و `roundedQuantity = packageCount`. واحد bag، piece، kg و ... عین مدل فعلی محصول باشد؛ سیاست فروش کسری جدید ایجاد نکن. در UI برای این کالاها «تعداد واحد فروش» با نام واحد نمایش بده، نه «کارتن/مترمربع».

### صلاحیت درخواست

1. مشتری احراز‌شده از نوع customer و فعال؛ دسته‌بندی مجاز و disableOrdering/hideExactStock هر دو false.
2. محصول فعال؛ حداقل یک supply-source فعال در انبار inquiry فعال.
3. مقدار پس از گردکردن محاسبه شود.
4. در بین warehouse-stockهای انبارهای exact فعال، اگر **هر یک** به‌تنهایی `inventorySqm >= roundedQuantity` دارد، درخواست مجاز نیست. مجموع یا balance بزرگ‌ترین انبار inquiry وارد این بررسی نشود.
5. وجود یک سبد خرید متصل به انبار دیگر مانع این بررسی سراسری نشود؛ هیچ draft خرید خودکار پاک یا عوض نشود.
6. source منتخب و تمام قواعد در ثبت نهایی CMS دوباره بررسی شوند؛ preview مجوز قطعی نیست. بررسی، وضعیت موجودی مشاهده‌شده در تراکنش ایجاد است؛ رزرو یا قفل‌کردن تمام انبارها برای آینده لازم نیست.
7. تغییر بعدی موجودی/منبع/فعال‌بودن محصول، درخواست ثبت‌شده را تغییر ندهد. مدیریت همچنان بتواند آن را تعیین وضعیت کند.

اگر خرید قطعی ممکن شد، خطای دامنه `EXACT_STOCK_AVAILABLE` با پیام فارسی برگردد؛ فرم باقی بماند و کاربر به خرید راهنمایی شود. در صورت وجود draft خرید، پیشنهاد خرید نباید binding تک‌انباری فعلی را بشکند.

### پالت نمایشی

```text
fullPallets = floor(packageCount / cartonsPerPallet)
remainingCartons = packageCount % cartonsPerPallet
```

| مثال | خروجی |
|---|---|
| ۴۷ کارتن، ضریب ۴۸ | ۴۷ کارتن؛ صفر پالت ننویس |
| ۴۸ کارتن، ضریب ۴۸ | ۱ پالت |
| ۵۶ کارتن، ضریب ۴۸ | ۱ پالت و ۸ کارتن |
| ۹۶ کارتن، ضریب ۴۸ | ۲ پالت |
| ضریب خالی | همان نمایش کارتن فعلی |
| other با هر ضریب باقیمانده | بدون نمایش پالت |

برای ۸۰ متر با کارتن ۱٫۴۴ و پالت ۴۸تایی، خروجی باید ۵۶ کارتن و ۸۰٫۶۴ متر باشد؛ **۱۳۸٫۲۴ متر خروجی نادرست این فاز است**.

snapshot ضریب پالت به آیتم سفارش‌های جدید هم اضافه شود؛ سفارش قدیمی بدون snapshot فقط کارتن نشان دهد و ضریب محصول فعلی را به تاریخچه تزریق نکن. محاسبات قیمت/موجودی/تعداد سفارش‌های موجود تغییر نکنند.

## ۶. وضعیت‌ها و هم‌زمانی

| مقدار قرارداد | عنوان فارسی | باز؟ | لغو مشتری |
|---|---|---|---|
| `new` | ثبت‌شده | بله | فقط اگر reviewStartedAt خالی است |
| `reviewing` | در حال بررسی | بله | خیر |
| `supplied` | تأمین شده | خیر | خیر |
| `unavailable` | غیرقابل تأمین | خیر | خیر |
| `cancelled_by_customer` | لغو توسط مشتری | خیر | لغو مجدد همان نتیجه را برگرداند |

### تغییر توسط کارکنان

- همان select وضعیت CMS کافی است. نقش‌های مدیر ارشد/مدیر/پشتیبانی چهار وضعیت غیرلغو را ساده انتخاب و اصلاح کنند؛ هیچ مسیر جداگانه اصلاح یا مجوز ویژه نساز.
- بازکردن صفحه خودکار reviewing نکند؛ کارمند صریح وضعیت را ذخیره کند.
- اولین تغییر مدیریت از new به هر وضعیت دیگر، reviewStartedAt را ثبت کند؛ در برگشت به new پاک نشود. پس از دیده‌شدن، اصلاح وضعیت نباید حق لغو را احیا کند.
- تغییر بین supplied و unavailable و بازگرداندن به وضعیت باز به روش معمول select مجاز است؛ از نظر سامانه صرفاً اصلاح وضعیت است. snapshotها و responseDueAt ثابت‌اند.
- cancelled_by_customer را مدیریت انتخاب یا بازگشایی نکند؛ نتیجه اقدام واقعی مشتری باقی بماند. نیاز به لغو مدیریتی در دامنه خواسته نشده است.
- save بدون تغییر status، زمان‌ها و پیامک را تغییر ندهد.

### لغو مشتری

- فقط مالک درخواست؛ شناسه مشتری از context معتبر API گرفته شود.
- API ownership را بررسی کند و فقط patch وضعیت cancelled_by_customer را به CMS service بفرستد.
- CMS قبل از خواندن/به‌کاربردن originalDoc برای update، ردیف supply_requests را `FOR UPDATE` قفل کند؛ الگوی `_lock-order.before-operation.ts` را برای collection جدید تطبیق بده. bulk update را برای این collection نپذیر.
- پس از قفل، وضعیت جاری باید new و reviewStartedAt خالی باشد. اگر reviewing یا نهایی شده خطای `CANNOT_CANCEL`؛ اگر قبلاً لغوشده همان سند برگردد.
- همان قفل برای save مدیریت برقرار باشد. در رقابت لغو و شروع بررسی، فقط یکی برنده شود؛ سمت بازنده وضعیت تازه را ببیند. تست PostgreSQL لازم است، mock کافی نیست.
- هیچ قاعده ۶۰ دقیقه‌ای سفارش‌های معمول به درخواست منتقل نشود.

### مهلت

`isOverdue = status in [new, reviewing] && now >= responseDueAt`. مقدار ذخیره‌شده status جدیدی به اسم overdue ساخته نشود. بازگشایی مدیریت مهلت را از اول شروع نمی‌کند. هیچ cron برای این محاسبه لازم نیست؛ در read و UI با زمان جاری محاسبه شود.

## ۷. قرارداد و API

فایل جدید `packages/contract/src/supply-request.ts`. تمام schemaها و typeهای درخواست/پاسخ اینجا باشند و از index صادر شوند. `z.any()`، شکل موازی در وب و خروجی خام CMS برای مسیر جدید ممنوع.

### DTOها

- `SupplyRequestStatusSchema`: پنج enum بخش ۶.
- `SupplyPreviewInputSchema`: `{ productId: positiveInteger, requestedQuantity: positiveFiniteMax1mTwoDecimals }`.
- `SupplyWarehouseSchema`: `{ id: positiveInteger, code: string, name: string }`؛ فقط نام/کد لازم، نه آخرین گزارش و سایر داده داخلی source.
- `SupplyQuoteSchema`: `{ productId, productType, unit, requestedQuantity, packageCount, roundedQuantity, salesFactor, cartonsPerPallet: positiveInteger|null, estimatedUnitPrice, estimatedTotal }`.
- preview output: `{ eligible: boolean, reason: 'exact_stock_available'|'no_active_source'|null, warehouses: SupplyWarehouse[], quote: SupplyQuote }`؛ عدم مجوز/محصول نامعتبر error باشد، نه eligible=false.
- submit input: `{ productId, warehouseId, requestedQuantity, notes?: stringMax2000, idempotencyKey: uuid }`؛ قیمت، مقدار گرد‌شده، userId یا status از کلاینت نپذیر.
- `SupplyRequestSchema`: `{ id, requestNumber, status, productId, productName, productSku, productImage: string|null, warehouseId, warehouseName, warehouseCode, productType, unit, requestedQuantity, packageCount, roundedQuantity, salesFactor, cartonsPerPallet: number|null, estimatedUnitPrice, estimatedTotal, notes, createdAt, updatedAt, responseDueAt, reviewStartedAt: datetime|null, resolvedAt: datetime|null, cancelledAt: datetime|null, canCancel: boolean, isOverdue: boolean }` با validator دقیق ID/عدد/تاریخ.
- list input: `{ page?: intMin1Default1, limit?: int1to100Default20, status?: SupplyRequestStatus }`؛ خروجی `{ items: SupplyRequest[], total, page, limit, totalPages }`.
- detail/cancel input: `{ id: positiveInteger }`؛ خروجی SupplyRequest.

### عملیات `appContract.supplyRequest`

| عملیات | رفتار |
|---|---|
| `preview` | quote جاری، انبارهای منبع فعال و امکان ثبت؛ بدون تغییر داده |
| `submit` | اعتبارسنجی، idempotency و ایجاد از طریق CMS؛ بازگشت DTO |
| `list` | فقط درخواست‌های مالک، مرتب‌سازی جدیدترین، pagination سرور |
| `detail` | فقط مالک؛ ناموجود و متعلق به دیگری هر دو NOT_FOUND |
| `cancel` | لغو پیش از بررسی با کنترل اتمیک CMS |

همه روی `customerOnly` سوار شوند؛ status فعال حساب در هر درخواست تازه سنجیده شود. disableOrdering/hideExactStock و دسته‌بندی برای preview/submit اعمال شوند. محدودیت جدید ثبت، سابقه شخصی و حق لغو مجاز قبلی را حذف نکند؛ مشتری احراز‌شده و فعال می‌تواند history خود را ببیند حتی اگر بعداً فقط‌کاتالوگ شده باشد. تعلیق/ban طبق auth فعلی رفتار کند.

errors را در قرارداد تعریف کن: UNAUTHORIZED، FORBIDDEN، NOT_FOUND، BAD_REQUEST، CONFLICT، EXACT_STOCK_AVAILABLE، SOURCE_UNAVAILABLE و CANNOT_CANCEL. پیام CMS را با کد محدود دامنه به API منتقل کن؛ SQL، stack و متن فنی خام به کاربر نده. برای تضاد idempotency از CONFLICT استفاده شود.

### ثبت و idempotency

1. API هویت customer و مجوز جاری را می‌سنجد؛ body حاوی شناسه مشتری پذیرفته نشود.
2. ورودی notes trim و fingerprint canonical شود. hash key به مشتری scope شود.
3. اگر key قبلاً وجود دارد، fingerprint یکسان همان سند را برگرداند؛ متفاوت CONFLICT. این replay **پیش از** بررسی دوباره قیمت/منبع/موجودی انجام شود تا ثبت موفق قبلی با تغییر داده‌های زنده گم نشود.
4. اگر سند قبلی نیست، SDK create با user از context و ورودی‌های مجاز انجام شود. CMS user فعال، مجوز محصول، source، نوع انبار، مقدار، موجودی قطعی و قیمت جاری را خودش بررسی/محاسبه کند؛ صرف بررسی API کافی نیست.
5. unique constraint رقابت دو create را حل کند؛ در خطای یکتایی، پس از rollback سند برنده خوانده و fingerprint بررسی شود. از خطای اصلی، موفقیت ساختگی نساز.
6. قیمت یا بسته‌بندی تازه، درخواست تأیید دوباره تولید نکند؛ snapshot آخرین محاسبه CMS ثبت شود. key فقط ورودی اصلی را fingerprint کند، نه قیمت یا quote ناپایدار.
7. ثبت جدید عمدی بعد از موفقیت UUID تازه می‌گیرد؛ روی open requestها قید یکتا نساز.

CMS read داخلی با depth صفر و select محدود باشد. پاسخ API را با mapper صریح snapshot بساز؛ رابطه populateشده user/product و basePrice/markup/key/fingerprint یا شماره تماس به خروجی راه پیدا نکنند.

## ۸. جداسازی انبار قطعی در تمام مسیرها

این بخش شرط صحت قابلیت است، نه cleanup اختیاری:

1. `apps/api/src/routers/warehouse.ts`: نامزدهای خرید فقط `{ isActive: true, stockMode: exact }`.
2. `apps/api/src/routers/warehouse-stock.helpers.ts`: حداکثر موجودی فقط از exact فعال؛ inquiry حتی اگر داده balance نامعتبر باقی مانده باشد شمرده نشود.
3. `apps/cms/src/collections/warehouse-stock/warehouse-stock.collection.ts`: create balance فقط exact؛ UI relation filter و hook سرور هر دو.
4. `warehouse-stock/_import.endpoints.ts`: preview و apply برای stock/kimia باید انبار exact فعال را دوباره بررسی کنند. mode=price وابستگی تازه به انبار نگیرد.
5. `warehouse-stock/_stock-operations.ts`: reserve و replace انبار exact فعال را کنترل کنند؛ restore تاریخی به همان انبار و در صورت غیرفعال‌بودن هم درست بماند. تغییر نوع انبار referenced ممنوع است، بنابراین restore نباید به شرط فعال‌بودن تازه وابسته شود.
6. `orders/_prepare-order.before-validate.ts`: ساخت سفارش فقط انبار exact فعال؛ مسیر مستقیم CMS هم نتواند سفارش از inquiry بسازد.
7. UI انتخاب انبار import فقط exact را نشان دهد؛ validation سرور جایگزین حذف گزینه UI نیست.
8. با source و supply-request هیچ‌یک از stock import، reserve، restore و قاعده سبد تک‌انباری فعال نشوند.

## ۹. کاتالوگ و UI با کمترین تغییر

### متادیتای محصول

به پاسخ‌های محصول `hasSupplySource: boolean` و `cartonsPerPallet: number|null` اضافه کن. `hasSupplySource` یعنی منبع فعال هست، **نه** اینکه هر مقدار دلخواه درخواست‌پذیر است. inventorySqm/stockCartons/inStock همچنان فقط موجودی قطعی باشند.

در `attachWarehouseStock` یک query گروهی منابع برای IDs همان batch اضافه کن؛ N+1 نساز. سپس متادیتا از list، getById، scan و shoppingهای موجود عبور کند. schemaهای محصول مرتبط در `packages/contract/src/catalog.ts`، خصوصاً `ScannedCatalogProductSchema`، باید فیلدها را حفظ کنند. mapper `product-store.ts` و `types/product.ts` دو فیلد را بپذیرند؛ شکل جدید محصول عمومی از صفر طراحی نکن. markup، scanCode و قیمت پایه همچنان مخفی بمانند.

### صفحه محصولات: دو حالت صریح

- در `routes/product/index.tsx` کنار کنترل‌های موجود انتخاب «خرید از موجودی / درخواست تأمین» اضافه شود؛ default خرید و mode در URL با `nuqs` و literal parser ذخیره شود. با validateSearch فعلی و `productId` سازگار بماند.
- در mode خرید، مسیر فعلی selectionStore و bulk selection حفظ شود؛ نمایش معادل پالت فقط یک سطر اضافه است.
- در mode تأمین، محصولات دارای hasSupplySource نمایش داده شوند؛ انتخاب کارت یک محصول، مودال درخواست را باز کند، نه selectProduct خرید.
- محصول دارای موجودی قطعی هم در حالت تأمین قابل بازکردن است تا کاربر مقدار بیشتر وارد کند؛ preview مقدار است که امکان ثبت را تعیین می‌کند. بر اساس مقدار پیش‌فرض کوچک، محصول را از این حالت مخفی نکن.
- فیلتر «فقط موجود» مخصوص خرید است؛ در حالت تأمین آن predicate اعمال نشود و کنترل پنهان شود، ولی مقدار فیلتر خرید هنگام برگشت حفظ شود. فیلترهای متن/برند/دسته همچنان کار کنند.
- hasSupplySource false => در mode تأمین انتخاب‌پذیر نیست؛ inStock=false به‌تنهایی مانع درخواست نباشد.
- product-card و product-bottom-sheet یک prop محدود برای حالت/اقدام تأمین بگیرند؛ سیستم عمومی render prop یا بازطراحی کارت نساز.
- در mode تأمین badge «قابل استعلام» و اقدام «درخواست تأمین»؛ در خرید stock قطعی فعلی. اسکن QR و لینک مستقیم محصول هم در mode جاری درست رفتار کنند.

### مودال ثبت تأمین

فایل مستقل `features/supply-requests/supply-request-modal.tsx` از Modal موجود و چیدمان پنجره تعیین مقدار استفاده کند؛ از هوک useCart یا selectionStore استفاده نکند. کپی‌برداری محدود چیدمان از ساخت abstraction مشترک بزرگ کم‌هزینه‌تر است.

- یک محصول، ورودی مقدار، واحد صحیح، تعداد بسته/معادل پالت، برآورد مبلغ، یادداشت و انتخاب انبار.
- یک source: انتخاب خودکار؛ چند source: انتخاب صریح مشتری؛ صفر source: خطای روشن و حفظ فرم.
- مقدار به inventorySqm clamp نشود؛ bound فقط مقدار معتبر قرارداد باشد. تغییر مقدار preview را debounce کند؛ پاسخ قدیمی با query key مقدار/محصول کنار گذاشته شود.
- اگر eligible=false به دلیل موجودی کافی: توضیح و اقدام «خرید از موجودی»؛ submit بسته باشد. تغییر mode خرید بدون پاک‌کردن draft تأمین؛ ثبت خودکار در سبد ممنوع.
- preview خطا دارد/در حال دریافت است یا انبار معتبر انتخاب نشده => دکمه ثبت غیرفعال. submit خودش دوباره همه قواعد را می‌سنجد.
- متن ثابت: «این درخواست رزرو یا خرید قطعی نیست. مجموعه حداکثر تا ۴۸ ساعت درباره امکان تأمین با شما هماهنگ می‌کند. مبلغ نمایش‌داده‌شده برآورد با قیمت فعلی است.»
- برچسب roundedQuantity «مقدار معادل بسته کامل» باشد، نه وعده «مقدار تحویلی».
- پس از موفقیت: شماره پیگیری درخواست، پاک‌کردن فقط draft ارسال‌شده و بازکردن تب درخواست‌ها. سفارش‌ها و draft خرید دست نخورند.
- در timeout احتمال ثبت را بیان کن و همان کلید برای تلاش مجدد حفظ شود. فرم را خودکار پاک یا UUID را عوض نکن.

### پیش‌نویس مستقل

`features/supply-requests/supply-request-draft.ts`: store کوچک با یک owner و یک payload؛ persisted key مثل `persianpart_supply_draft_v1:<owner>`.

payload: `{ productId, warehouseId: number|null, requestedQuantity, notes, submissionKey }`؛ key با هر تغییر واقعی ورودی canonical عوض شود، نه با بازشدن مودال/preview. همان محصول و انبار، فرم قبلی را resume کند؛ تغییر محصول یا انبار از انتخاب موجود با تأیید انجام شود. لغو تأیید، داده قبلی را حفظ کند. فرم ارسال‌شده را بر اساس owner و fingerprint پاک کن تا پاسخ دیررس فرم جدید را حذف نکند.

در `routes/__root.tsx` owner مانند سبد فعلی تنظیم شود. `lib/drafts.ts` و خروج/انقضای auth در `auth-store.ts` پاک‌سازی و flush این draft را هم پوشش دهند؛ رویدادهای flush/discard موجود را استفاده کن. داده یک مشتری برای مشتری دیگر نمایش داده نشود. storage failure پیام روشن داشته باشد؛ crash نکند. تضمین cross-device نساز.

### تاریخچه در همان سفارش‌ها

- `routes/orders/index.tsx`: دو تب «سفارش‌ها» و «درخواست‌های تأمین»؛ query پارامتر `view=supply` و `requestId` عددی اعتبارسنجی شود؛ default سفارش‌ها.
- `features/supply-requests/supply-request-list.tsx`: query مستقل با pagination سرور ۲۰تایی؛ از type/order-store سفارش معمول استفاده نکن.
- کارت درخواست از ظاهر کارت فعلی استفاده کند؛ عنوان «درخواست»، شماره SPR، نام محصول، مقدار اصل/معادل بسته کامل، انبار، برآورد زمان ثبت، وضعیت، مهلت و یادداشت نمایش دهد. برچسب «فاکتور»، پیش‌فاکتور، ارسال و پرداخت نداشته باشد.
- جزئیات در مودال همان صفحه با `supply-request.detail`؛ `requestId` خارج صفحه فعلی list هم قابل بازشدن باشد. route جزئیات سفارش را دوحالته نکن.
- canCancel از پاسخ سرور + وضعیت محلی نمایش؛ اقدام با تأیید کوتاه و refresh در CONFLICT/CANNOT_CANCEL. قاعده ۶۰ دقیقه سفارش استفاده نشود.
- query keys با owner، پارامتر list و id؛ مالکیت cache بین حساب‌ها رعایت شود. هنگام mutation list/detail مربوط invalidate شوند.
- مهلت برای new/reviewing دیده شود؛ تأخیر با متن «مهلت پاسخ گذشته» و بدون رد خودکار. تازه‌سازی سبک زمان در حالت visible کافی است؛ background polling پرسرعت نساز.

### پالت در خرید فعلی

helper نمایشی کوچک در `lib/utils/unit.ts` یا فایل هم‌سطح `packaging.ts` اضافه کن؛ یک helper خالص برای تقسیم و یک formatter با toPersianDigits کافی است.

سطوح لازم: product-config-card، cart-item-row، پیش‌فاکتور فعال `features/checkout/pre-invoice-modal.tsx` و ردیف تاریخچه/جزئیات سفارش در `order-invoice-modal.tsx` و `routes/orders/$id.tsx`. هر مسیر واقعی نمایش بسته‌بندی را بررسی کن؛ فایل order-entry-modal بی‌مصرف را به‌عنوان تحویل قابلیت حساب نکن. در summary چند محصول، پالت‌های SKUهای مختلف را به یک «پالت مشترک» جمع نکن؛ نمایش پالت در سطح ردیف باشد.

فقط نمایش و انتقال snapshot اضافه شود؛ refactor قیمت یا اصلاح اختلاف احتمالی rounding فعلی خرید خارج دامنه است. RTL، اندازه‌ها، tokenها و اجزای HeroUI موجود حفظ شوند؛ کنترل جدید بر اساس API واقعی component و skill heroui-v3 نوشته شود.

## ۱۰. پیامک با دامنه محدود

- helper موجود `sendSmsNotification` بازاستفاده شود؛ credential در سند/تست/کد تازه hardcode یا کپی نشود. در تست `DISABLE_SMS=true` و provider mock.
- hook کوچک afterChange روی SupplyRequests: فقط وقتی status واقعاً تغییر کرده و وضعیت جدید supplied یا unavailable است، یک پیام عمومی «نتیجه درخواست ... ثبت شد؛ مشاهده در ...» به شماره جاری حساب مشتری تلاش شود.
- همان وضعیت دوباره save شود => پیامک دوباره نه. اصلاح از یک نتیجه به نتیجه دیگر => همان اطلاع‌رسانی عمومی به‌دلیل تغییر نتیجه؛ workflow مخصوص اصلاح نساز. بازگشت به new/reviewing یا لغو پیامک ندارد.
- لینک به آدرس پیکربندی‌شده وب و `/orders?view=supply&requestId=<id>`؛ صرفاً عدد/وضعیت و لینک، بدون یادداشت و مبلغ.
- شکست/نبود تنظیمات provider نباید ذخیره نتیجه را rollback کند؛ log محدود بدون secret و بدون ادعای delivered ثبت شود. retry queue، outbox یا دکمه مدیریت ارسال در این فاز نساز.
- **محدودیت فنی صریح این انتخاب ساده:** در نسخه نصب‌شده Payload، afterChange و afterOperation پیش از commit هستند (`collections/operations/updateByID.js`). الگوی موجود Plans نیز ارسال را transactional نمی‌کند. این پلن ارسال best effort را انتخاب می‌کند؛ تضمین تحویل، exactly-once، یا تضمین عدم ارسال در شکست commit نهایی وجود ندارد. پیام عمومی است و وضعیت معتبر داخل سایت مرجع است. مدل اجراکننده نباید hook را «ارسال قطعی پس از commit» بنامد یا در تست چنین موفقیتی ادعا کند. راه‌حل تضمینی نیازمند دامنه جدا برای delivery است و فعلاً ساخته نشود.

## ۱۱. نقشه فایل‌ها

نام فایل‌های جدید پیشنهادی قطعی است؛ اگر به دلیل حجم یک فایل را به hook هم‌مسئولیت تفکیک کردی، مسئولیت و ترتیب این جدول را حفظ کن.

| حوزه | جدید | ویرایش موجود |
|---|---|---|
| قرارداد | `packages/contract/src/supply-request.ts` | `src/index.ts`، `src/catalog.ts`، schema آیتم سفارش در `src/order.ts`؛ فقط فیلد snapshot لازم |
| CMS منبع | `apps/cms/src/collections/supply-sources/supply-sources.collection.ts` | warehouses/warehouses.collection.ts و payload.config.ts |
| CMS درخواست | `collections/supply-requests/supply-requests.collection.ts`، `_prepare-request.before-validate.ts`، `_lock-request.before-operation.ts`، `_validate-request.before-change.ts`، `_notify-result.after-change.ts` | payload.config.ts، access/roles.ts در حد predicateهای لازم |
| محاسبه | helper محدود در `collections/products/_inventory-math.ts` | products.collection.ts، orders/_prepare-order.before-validate.ts برای snapshot فقط |
| مهاجرت | migration افزایشی `*_supply_requests_and_pallets.ts` و snapshot تولیدشده | migrations/index.ts، payload-types.ts تولیدشده، _schema-inspect.test.ts |
| حفاظت stock | — | warehouse-stock.collection.ts، _stock-operations.ts، _import.endpoints.ts، components/stock-import.tsx، orders/_prepare-order.before-validate.ts |
| API | `apps/api/src/routers/supply-request.ts` | routers/index.ts، warehouse.ts، warehouse-stock.helpers.ts؛ mapper/sanitizer محدود متادیتا |
| وب تأمین | `features/supply-requests/supply-request-draft.ts`، `supply-request-modal.tsx`، `supply-request-list.tsx`، `supply-request-detail-modal.tsx` | routes/product/index.tsx، product-card.tsx، product-bottom-sheet.tsx، product-filters.ts، product-store.ts، types/product.ts |
| وب lifecycle | — | routes/__root.tsx، features/auth/auth-store.ts، lib/drafts.ts، lib/query-keys.ts، routes/orders/index.tsx |
| وب پالت | `lib/utils/packaging.ts` در صورت جداسازی helper | product-config-card.tsx، cart/cart-store.ts برای فیلد فقط، cart-item-row.tsx، checkout/pre-invoice-modal.tsx، orders/order-invoice-modal.tsx، routes/orders/$id.tsx، types/order.ts و mapper order-store.ts در حد snapshot |
| مستندات | — | docs/01-domain-models.md، 02-business-rules.md، 03-system-flows.md، 04-roles-and-permissions.md، 05-architecture-and-contracts.md، 06-admin-and-operations.md، 07-warehouses.md؛ overview فقط برای دامنه |

اگر API schema موجود آیتم سفارش passthrough ندارد، snapshot را صریح اضافه کن تا در runtime strip نشود. routeTree.gen.ts دستی ویرایش نشود؛ این طرح route جدید لازم ندارد.

## ۱۲. مهاجرت و داده موجود

1. migration افزایشی با Payload tooling بساز و SQL/metadata را بازبینی کن؛ baseline فعلی حفظ شود.
2. stockMode required با default exact؛ backfill تمام رکوردهای قدیمی؛ هیچ balance/order/product حذف یا تبدیل نشود.
3. cartonsPerPallet محصول و snapshot آیتم سفارش nullable؛ سفارش قدیمی backfill از محصول فعلی نشود.
4. دو collection، enum پنج‌حالته، FKها، index مالک/تاریخ و pair unique source و unique key درخواست ساخته شوند. constraint مثبت/غیرمنفی مطابق validation و امکانات schema موجود باشد.
5. seed فعلی به انبارهای exact ادامه دهد؛ اگر fixture استعلامی لازم است فقط fixture تست مستقل باشد. به بهانه beta بودن، reset یا بازنویسی seed داده فعلی انجام نشود.
6. آزمون migration هم fresh chain را اجرا کند و هم baseline + داده قدیمی + migration جدید را؛ پس از up، سفارش، balance و کلیدها/مقادیر قدیمی عیناً موجود باشند.
7. `_schema-inspect.test.ts` از فرض یک migration اصلاح شود؛ آزمون‌های schema coverage حذف یا ضعیف نشوند. down/up فقط در DB موقت خالی از داده عملیاتی بررسی شود؛ down شامل حذف داده قابلیت است و راه rollback عملیاتی بدون‌خطر محسوب نمی‌شود.
8. برای اجرا روی داده واقعی، موجودی نامعلومِ واردشده در گذشته را خودکار تشخیص نده. مدیر باید انبار inquiry و منابع را ایجاد کند؛ این مرحله operational setup است، نه استنتاج migration.

## ۱۳. مراحل اجرای وابسته و قابل بررسی

از repo root، فقط pnpm. در شروع `git status --short` و AGENTSهای مسیر و skillهای لازم را بخوان. کارهای کاربر را پاک/بازنویسی نکن. این پلن خودش دستور اجرای محصول نیست.

### مرحله A — داده و قوانین محلی CMS

- نوع انبار، ضریب محصول و snapshot سفارش، دو collection و hooks، role guards و محاسبه خالص را بساز.
- جداسازی انبار exact در CMS import/reserve/prepare را اعمال کن.
- نوع‌ها و migration تولید و بازبینی شوند. هنوز قرارداد ریشه API را به implementer بدون handler وصل نکن.
- تست CMS محاسبات، immutability، مجوز و وضعیت‌ها اضافه و در script `test:hardening` واقعاً ثبت شود؛ نوشتن فایل تست بدون ورود به runner کافی نیست.
- checkpoint: CMS typecheck، تست واحد جدید و تست‌های hardening موجود؛ migration و رقابت لغو با PostgreSQL موقت در دسترس.

### مرحله B — قرارداد و API، به‌صورت یک گام یکپارچه

- contract جدید و DTOها، metadata محصول، handlerها و ثبت همزمان در appContract/router.
- افزودن contract root بدون handler تا انتهای مرحله ممنوع، چون implementer ریشه از compile می‌افتد.
- query موجودی خرید exact، sourceهای batch، idempotency و mapping errors تکمیل شوند.
- checkpoint: contract/API/CMS/web typecheck و API tests؛ schemaهای QR فیلد تازه را نگه دارند و داده محرمانه نشت نکند.

### مرحله C — مسیر تأمین وب

- draft مستقل و lifecycle حساب، مودال، دو حالت کاتالوگ و تب/جزئیات تاریخچه.
- query keys و mutation invalidation؛ خطا/بارگذاری/صفرمنبع/منبع متعدد/موجودی کافی پوشش داده شوند.
- هیچ تغییر رفتاری در سبد قطعی و import آن ایجاد نشود.
- checkpoint: web typecheck و build؛ مرورگر narrow/desktop و جریان واقعی وب→API→CMS با provider mock.

### مرحله D — نمایش پالت در خرید و تاریخچه

- helper و ردیف‌های خرید/تأمین، snapshotهای سفارش جدید و mapperها.
- سفارش قدیمی بدون ضریب نمایش خراب نداشته باشد؛ SKUهای متعدد پالت تجمیعی نگیرند.
- checkpoint: تست مثال‌های بخش ۵، web build، خرید معمول/لغو/restore و پیش‌فاکتور بدون تغییر مقدار و مبلغ.

### مرحله E — اطلاع‌رسانی، یکپارچه‌سازی و مستندات

- hook اطلاع‌رسانی با الگوی محدود بخش ۱۰ و mock، تست تغییر وضعیت و عدم ارسال در no-op.
- migration integration، race tests و E2E مرتبط را اجرا؛ مستندات جاری به‌روزرسانی شوند.
- گزارش تحویل شامل فایل‌ها، دستور/خروجی واقعی checks، skippedها و محدودیت پیامک/دستگاه باشد. «build شد» را معادل «قابلیت کار می‌کند» گزارش نکن.

## ۱۴. آزمون‌های پذیرش الزامی

این تغییر مالی/موجودی/مجوز و هم‌زمانی دارد؛ تست‌های زیر قرارداد قابل مشاهده را می‌سنجند، نه ساختار داخلی توابع.

### داده و انبار

1. migration روی baseline با order/balance قبلی، همه داده‌ها را حفظ و stockMode=exact کند.
2. source تکراری در یک product/warehouse در DB رد شود؛ محصول با دو منبع مجاز باشد.
3. ثبت source در exact و balance/stock import در inquiry رد شود؛ mode=price فعلی سالم بماند.
4. inquiry از stock badge، availability و reserve قطعی بیرون باشد؛ حتی fixture balance اشتباه برای آن موجب فروش نشود.
5. restore سفارش قدیمیِ انبار exact غیرفعال همچنان درست باشد؛ تغییر نوع انبار referenced رد شود.

### صلاحیت و محاسبه

6. منبع فعال + exact ناکافی => درخواست مجاز؛ منبع/انبار/محصول غیرفعال یا دسته غیرمجاز => ثبت رد شود.
7. دو انبار exact هرکدام ۶۰ متر، تقاضای معادل ۱۰۰ متر => درخواست مجاز؛ جمع ۱۲۰ ملاک نیست.
8. یک exact با مقدار کافی => preview غیرمجاز و submit خطای EXACT_STOCK_AVAILABLE؛ فرم باقی بماند.
9. exact بین preview و submit کافی شود => هیچ درخواست تازه یا رزرو ایجاد نشود.
10. مشتری کل مقدار را درخواست کند، نه کسری خودکار؛ سبد خرید او دست نخورد.
11. آخرین قیمت/متراژ کارتن/ضریب سرور ثبت شود، بدون نیاز به تأیید مجدد؛ کلاینت قادر به تزریق مبلغ نباشد.
12. tile ۸۰، factor=۱٫۴۴، pallet=۴۸ => ۵۶ کارتن، ۸۰٫۶۴ متر، «۱ پالت و ۸ کارتن»؛ مبلغ دقیق قیمت حساب.
13. مرزهای ۴۷/۴۸/۴۹/۹۶ کارتن، ضریب null/نامعتبر، مقدار صفر/منفی/NaN/Infinity/بیش از سقف و دقت اعشار تست شود.
14. other با bag یا piece و تقاضای ۳٫۲ => ۴ واحد طبق فروش فعلی؛ هیچ پالت/متر/کارتن در متن آن نمایش داده نشود.

### ثبت، مجوز و تاریخچه

15. یک key با payload یکسان، حتی پس از تغییر قیمت/غیرفعال‌شدن source/کافی‌شدن stock، همان request را برگرداند؛ مجوز هویت همچنان لازم است.
16. key یکسان و payload متفاوت => CONFLICT؛ دو key متفاوت برای درخواست باز یکسان => دو درخواست مجاز.
17. دو submit همزمان یک key => فقط یک ردیف؛ losing transaction درست rollback شود؛ stock در تمام حالت‌ها ثابت بماند.
18. customer نتواند request دیگری را list/detail/cancel کند؛ admin با ID عددی مشترک customer نتواند از API مشتری استفاده کند.
19. فقط‌کاتالوگ/غیرفعال/دسته غیرمجاز نتواند submit کند؛ history مالک با سلب صرف مجوز سفارش همچنان قابل مشاهده باشد.
20. پشتیبانی فقط وضعیت؛ editor حق وضعیت ندارد؛ source فقط manager/superadmin؛ service نتواند snapshot یا وضعیت مدیریتی دلخواه patch کند.
21. ایجاد مستقیم CMS با user یا قیمت جعلی، status نهایی، انبار اشتباه و مقدار نامعتبر از hook عبور نکند؛ Local API tests با overrideAccess:false دسترسی را واقعاً بسنجند.
22. پس از تغییر نام/قیمت/بسته‌بندی محصول و انبار، snapshot درخواست و سفارش ثبت‌شده ثابت بماند؛ basePrice/markup/scanCode/شماره تماس از response جدید نشت نکند.

### وضعیت و مهلت

23. new و reviewStartedAt خالی => مالک لغو کند؛ لغو مجدد idempotent؛ reviewing و نتیجه‌ها لغوپذیر نیستند.
24. بازکردن صفحه CMS به‌تنهایی reviewing نکند؛ save صریح reviewing آن را عوض کند.
25. race واقعی PostgreSQL میان cancel و start-review: فقط یک نتیجه معتبر؛ هیچ request بررسی‌شده cancelled نشود و هیچ cancelled بازگشایی نشود.
26. مدیر نتیجه را با همان select اصلاح کند؛ snapshot و deadline ثابت؛ برگشت به new لغو را دوباره مجاز نکند.
27. سررسید دقیق createdAt+۴۸h شامل تعطیلی؛ در مرز now=due برای حالت باز overdue=true؛ هیچ تغییر status خودکار نباشد؛ نتیجه/لغو overdue نباشند.
28. تغییر موجودی یا منبع بعد از ثبت، آرشیو یا نتیجه را خودکار تغییر ندهد.

### UI و پیامک

29. سوییچ mode و بستن/بازکردن مودال، draft خرید را عوض نکند؛ draft تأمین مقدار و یادداشت را حفظ کند.
30. جایگزینی محصول/انبار با رد تأیید، draft قبلی را حفظ کند؛ پذیرش فقط همان draft را عوض کند.
31. logout/تعویض حساب/انقضای نشست/flush و خطای localStorage؛ داده مشتری قبلی برای بعدی دیده نشود.
32. پاسخ دیررس preview یا submit، فرم محصول جدید/حساب جدید را بازنویسی یا پاک نکند؛ timeout دوباره همان key را بفرستد.
33. محصول دارای exact کافی برای مقدار کوچک اما ناکافی برای مقدار بزرگ، در حالت تأمین قابل انتخاب و تغییر مقدار باشد؛ فیلتر inStock آن را اشتباه مخفی نکند.
34. QR و لینک مستقیم محصول خارج از batch اولیه ۵۰۰تایی بتواند درخواست را باز کند؛ detail history خارج از صفحه اول list هم باز شود.
35. پیامک فقط روی تغییر واقعی به نتیجه تلاش شود؛ no-op، new/reviewing/cancel ارسال نداشته باشند. خطای provider ذخیره وضعیت را خراب نکند؛ هیچ تست پیامک واقعی نفرستد.
36. وب در narrow و desktop با اعداد فارسی، واحد درست، متن بلند، یادداشت، انبار چندگزینه‌ای و safe area بررسی شود؛ خرید قبلی و پیش‌فاکتور یک smoke موفق داشته باشند.

## ۱۵. دستورهای بررسی و گزارش اجرای آینده

این دستورها برای اجراکننده آینده‌اند؛ در مرحله تهیه پلن اجرا نشده‌اند. از root و بر اساس نیاز مرحله، narrowest check اول. وجود Postgres محلی را از وضعیت سیستم بررسی کن؛ آدرس یا credential واقعی را در گزارش چاپ نکن.

```bash
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/contract exec tsc --noEmit
pnpm --filter @persianpart/cms exec tsc --noEmit
pnpm --filter @persianpart/api typecheck
pnpm --filter @persianpart/web exec tsc --noEmit
pnpm --filter @persianpart/cms test:hardening
pnpm --filter @persianpart/api test
pnpm --filter @persianpart/cms test:hardening:postgres
pnpm --filter @persianpart/cms test:hardening:migrations
pnpm --filter @persianpart/web build
pnpm --filter @persianpart/cms build
```

`generate:types` فقط وقتی dev server همزمان در حال تولید نیست؛ build فعلی CMS مستقیماً next build است، پس تولید نوع را فرض نکن. در صورت نیاز به component مدیریتی تازه، importmap با script موجود تولید شود؛ این طرح component مدیریتی سفارشی لازم ندارد.

تست‌های supply را به scriptهای CMS موجود وصل کن؛ integration جدید نیازمند Postgres در script مناسب ثبت شود. برای وب یک spec مرتبط مثل `apps/web/e2e/supply-request.spec.ts` با Playwright موجود بنویس و در محیط fixture ایمن اجرا کن:

```bash
pnpm --filter @persianpart/web exec playwright test e2e/supply-request.spec.ts
```

پیش از اجرا config و webServer فعلی Playwright را بخوان و مطمئن شو fixture هیچ API/DB واقعی را تغییر نمی‌دهد. اگر محیط live آماده نیست، تست mock را موفقیت live اعلام نکن. `CMS_MIGRATION_TEST_DATABASE_URI` و هر env آزمون را فقط به دیتابیس موقت محلیِ guardشده بده؛ تمام پیامک‌ها disabled/mock باشند. migration واقعی، migrate:fresh و seed واقعی جزو این اجرا نیستند.

## ۱۶. چک‌لیست تحویل برای مدل اجراکننده

- [ ] فقط دامنه تک‌محصولی و یک انبار اجرا شده؛ پاسخ چندمحصولی منسوخ مصرف نشده.
- [ ] فاز اول هیچ سیاست/فیلد اجبار پالتی ندارد؛ ضریب اختیاری است.
- [ ] درخواست از سفارش و stock مستقل است؛ تمام مسیرهای exact از inquiry جدا هستند.
- [ ] پنج وضعیت، لغو پیش از بررسی، اصلاح ساده و idempotency واقعی کار می‌کنند.
- [ ] سرور قیمت/بسته‌بندی و صلاحیت را می‌سنجد؛ retry همان ثبت را بازمی‌گرداند.
- [ ] تغییر UI به mode، مودال، تب تاریخچه و خطوط بسته‌بندی محدود است؛ سبد قطعی بازطراحی نشده.
- [ ] داده قدیمی و snapshotها حفظ شده‌اند؛ migration افزایشی در DB موقت آزموده شده.
- [ ] نتایج آزمون با نام/دستور/خروجی ثبت شده؛ skip و محدودیت SMS/live پنهان نشده‌اند.
- [ ] مستندات جاری و گزارش اجرا در brain به‌روز شده‌اند؛ این سند به‌اشتباه گزارش اجرای موفق نام‌گذاری نشده.

## ۱۷. راهنمای شروع کوتاه و توقف

```text
[NEXLOAD HANDOFF]
From: nexload-reasoning / discovery completed
To: nexload-reasoning-execution
Context Pointer: .agents/brain/supply-request-pallet-implementation-plan.md
Established Facts:
- درخواست فاز اول یک محصول و یک انبار دارد؛ پالت فقط نمایش است.
- سبد و رزرو فعلی بر موجودی قطعی و انبار واحد استوارند.
- اصلاح وضعیت باید ساده باشد؛ delivery تضمینی SMS تصویب نشده است.
Hard Constraints:
- contract SSOT، همان مجوز خرید، عدم رزرو استعلامی، عدم تغییر داده قدیمی.
- هیچ اجرای محصول بدون دستور اجرای کاربر؛ این سند فقط پلن است.
Settled Decisions:
- جدول بخش ۱ و آخرین پاسخ‌های discovery؛ پیشنهادهای منسوخ را اجرا نکن.
Next Cognitive Objective:
- پس از دستور اجرا، مرحله A را با بررسی وضعیت زنده repo آغاز و به ترتیب تا E تحویل بده.
[END HANDOFF]
```

برای نام‌گذاری helper یا تقسیم فایل، دوباره سؤال کسب‌وکار نپرس. اگر شواهد runtime خلاف فرض فنی پلن بود، همان شاهد و کوچک‌ترین تغییر لازم را ثبت کن؛ معماری را از اول طراحی نکن. اگر نیاز واقعی به درخواست چندمحصولی، اجبار پالت یا مدیریت ادامه فروش مطرح شد، آن‌ها نیاز جدید هستند و نباید پنهانی به این پیاده‌سازی اضافه شوند.
