# پلن اجرایی: ساده‌سازی محصول و به‌روزرسانی روزمره با پلاگین رسمی Payload

> **به‌روزرسانی (2026-10-28):** بخش «حالت نگهداری موجودی» (`CMS_STOCK_WRITE_MODE=normal|manual|import`) در این پلن با `1793189543145-production-inventory-simplification.md` منسوخ شد. موجودی اکنون مقدار مطلق بدون بازه نگهداری است و ایمپورت زنده اجرا می‌شود. سایر بخش‌ها معتبرند.

## ۰. قرارداد اجرای این پلن

- **وضعیت:** آماده اجرا پس از پذیرش پلن؛ این سند مجوز اجرای migration روی دیتابیس واقعی نیست.
- **خروجی:** فرم دو‌تب محصول، ورودی‌های عملیاتی محدود، داده‌های مشتق سازگار، import/export رسمی برای به‌روزرسانی محصولات موجود، و آزمون‌های قابل بازتولید.
- **اسکیل درخواستی:** `writing-for-agents` با ابزار Skill یافت نشد؛ در مسیرهای بررسی‌شده مخزن و تنظیمات محلی نیز موجود نبود. این سند ادعای استفاده از آن ندارد؛ قالب اجرایی شامل تصمیم، مسیر، اقدام، آزمون و شرط توقف است. نصب اسکیل خارج از دامنه است.
- **روش کم‌هزینه:** layout بومی و بدون نام Payload + پلاگین رسمی + یک preview کوچک ادمین؛ نه صفحه مدیریت جایگزین، importer اختصاصی، ورکر بیرونی یا state machine جدید.
- فقط `pnpm`؛ بدون commit، بازنویسی تغییرات موجود، ارتقای عمومی وابستگی‌ها یا اجرای generator/migration خارج از فایل‌های مرتبط.
- در آغاز اجرا وضعیت واقعی مجدداً بررسی شود: هنگام تحقیق HEAD برابر `adadb24` و working tree شامل فایل‌های حذف‌شده و replacementهای untracked بود. گزارش `git diff` به‌تنهایی نماینده تمام کد موجود نیست.

## ۱. تصمیم‌های تأییدشده و اولویت آنها

این تصمیم‌ها در همین گفت‌وگو به‌صراحت تأیید شده‌اند و نسبت به پیشنهادهای قبلی و قسمت‌های متعارض اسناد اولویت دارند:

| موضوع | تصمیم نهایی |
|---|---|
| ورودی‌های روزمره | `basePricePerSqm`، `sqmPerCarton` و `inventorySqm`؛ اطلاعات هویتی/فنی همچنان برای تعریف محصول لازم است. |
| دامنه import | فقط update محصولات موجود با `matchField: 'sku'`؛ create/upsert ممنوع. محصول جدید از فرم ساخته می‌شود. |
| فایل عملیاتی | دقیقاً `sku,basePricePerSqm,inventorySqm`؛ SKU ناشناخته خطای ردیف و بدون ساخت محصول. |
| معنای inventorySqm | موجودی خالص قابل سفارش، پس از کسر رزروها؛ نه موجودی فیزیکی ناخالص. |
| شکست import | موفقیت جزئی ردیفی پذیرفته است؛ ردیف سالم باقی می‌ماند و ردیف نامعتبر گزارش می‌شود. تضمین تراکنش کل فایل حذف می‌شود. |
| هم‌زمانی | از پیش از تهیه فایل تا اتمام import، تمام نویسنده‌های دیگر موجودی و ثبت/لغو سفارش متوقف و drain شوند؛ توقف سمت سرور، نه توصیه رابط کاربری. |
| کنترل توقف | توقف عملیاتی سرویس‌ها؛ **بدون** global/جدول یا کلید روشن‌خاموش جدید در پنل. |
| ویرایش دستی موجودی | فقط در بازه توقف؛ در یک بازه یا فرم تکی یا import، نه هر دو. قیمت و محتوای محصول خارج از بازه قابل ویرایش‌اند. |
| نقش عملیاتی انسانی | `superadmin`، `manager` و `support` برای قیمت/موجودی و import/export؛ `editor` فقط محتوای کاتالوگ؛ `service` صرفاً مسیرهای داخلی قبلی و بدون import/export. |
| چیدمان | دو تب اصلی «اطلاعات اصلی» و «تنظیمات و مشخصات». |
| محاسبات نمایشی | preview زنده فقط ادمین، نه virtual جدید در پاسخ محصول/API. |
| slug | ذخیره‌شده، unique و required باقی می‌ماند؛ تولید خودکار هنگام ساخت، حفظ مقدار قبلی در update. |
| piecesPerCarton | مستقل و دستی در بخش پیشرفته؛ از ابعاد/ضریب حدس زده نمی‌شود. |

### خارج از دامنه

- ایجاد یا enrichment محصولات از فایل؛ import روابط، عکس، richText یا taxonomy.
- CSV تراکنشی همه‌یا‌هیچ، diff مالی کامل، هشدارهای سفارشی درصدی، ImportRun موازی و پنل سفارشی import.
- نسخه‌گذاری انبار، همگام‌سازی موجودی فیزیکی ناخالص و فروش هم‌زمان با جایگزینی مطلق موجودی.
- حذف ستون‌های محصول، nesting داده، تغییر public DTO، بازسازی قراردادها و پاک‌سازی عمومی `any`.
- propagation خودکار تغییر رکورد Dimensions به همه محصولات؛ ابعاد ذخیره‌شده همچنان snapshot هنگام انتخاب/تغییر رابطه است.
- تضمین اجرای سفارش روی SQLite؛ صحت تراکنش انبار باید روی PostgreSQL اثبات شود.

## ۲. شواهد و اصلاح برداشت‌های قبلی

| شاهد | پیامد اجرایی |
|---|---|
| `apps/cms/src/collections/products/products.collection.ts:26` | rows/collapsibles فعلی flat هستند؛ تب‌ها **بدون name** باشند تا path فیلد/ستون/قرارداد عوض نشود. |
| `apps/cms/src/collections/products/_sync-slug-and-dimensions.before-validate.ts:7` | SKU-only PATCH اکنون می‌تواند slug را دوباره بسازد؛ حفظ originalDoc لازم است. |
| همان فایل `:22` | ابعاد فقط هنگام ارسال dimension همگام می‌شوند و خطا بلعیده می‌شود؛ ادعای نمایش فوری ابعاد با هوک سرور درست نیست. |
| `apps/cms/src/collections/orders/_apply-reservation.before-change.ts:63` و `:105` | رزرو/بازگردانی SQL خام است و هوک محصول را دور می‌زند؛ تغییر فقط Product hook کافی نیست. |
| `packages/contract/src/catalog.ts:194` | قرارداد داخلی dimension relationship و stockCartons را مانند CMS مدل نمی‌کند؛ layout نباید این تفاوت را به تغییر قرارداد تبدیل کند. |
| `apps/api/src/routers/router.helpers.ts:106` | mapper فعلی فقط قیمت پایه را حذف و باقی محصول را spread می‌کند؛ virtual قیمت هر کارتن خطر افشای قیمت پایه دارد. |
| `apps/cms/src/access/roles.ts:35` | support اکنون catalog-manager نیست؛ مجوز update باید محدود و field-aware گسترش یابد، نه با مجوز کامل create/delete. |
| `apps/cms/src/migrations/_schema-inspect.test.ts:100` | تست فعلی شکست ساخت سفارش به‌علت ID رشته‌ای را ثبت کرده؛ این محدودیت منبع است، نه موفقیت runtime. |
| `.kilo/plans/1793089634859-cms-corrective-hardening.md:54` | serialization و محافظت بسته‌بندی قبلاً تصمیم‌گیری شده؛ این پلن باید با آن هم‌راستا باشد. |

**اصلاح قطعی:** «هیچ migration لازم نیست» صحیح نبود. layout و preview نباید schema محصول را تغییر دهند، اما پلاگین collections/uploads و taskهای داخلی اضافه می‌کند؛ schema نهایی باید بررسی و migration افزایشی آن تولید شود.

**اصلاح قطعی:** `readOnly` فقط رفتار ادمین است؛ صحت، مجوز و جلوگیری از مقدار جعلی باید در سرور enforce شود. `afterRead` یا `beforeValidate` نیز preview زنده فرم نیست.

## ۳. طراحی فرم و مالکیت فیلدها

### تب ۱: اطلاعات اصلی

1. ردیف `name` + `sku`؛ SKU هنگام ایجاد ورودی و پس از ایجاد غیرقابل‌تغییر، با enforce سمت سرور برای مسیرهای عادی.
2. ردیف `basePricePerSqm` + `sqmPerCarton` + `inventorySqm`، با واحدهای واضح تومان/مترمربع.
3. `stockCartons` موجود، read-only؛ کمک‌متن «پس از ذخیره محاسبه می‌شود».
4. یک فیلد بومی `type: 'ui'` با کامپوننت کوچک preview، وابسته به state فعلی فرم:
   - تعداد کارتن کامل قابل فروش؛
   - قیمت **پایه** هر کارتن؛ صراحتاً نه قیمت نهایی مشتری؛
   - باقی‌مانده متراژ خارج از کارتن کامل، فقط برای فهم اختلاف متراژ و کارتن؛
   - مقادیر نامعتبر به‌صورت «نیازمند اصلاح ورودی» و نه صفر جعلی نمایش داده شوند.
5. `isActive` با معنای مستقل از موجودی؛ ناموجود بودن نباید آن را خودکار false کند.

### تب ۲: تنظیمات و مشخصات

- بخش مشخصات: `category`، `brand`، `dimension`، `grade`، `color`، `tags`.
- نمایش read-only `width` و `height` با برچسب «همگام‌شده پس از ذخیره»؛ نیازی به fetch زنده رابطه در کلاینت نیست.
- بخش رسانه و محتوا: `cover`، `gallery`، `richDescription`.
- collapsible پیشرفته، بسته به‌صورت پیش‌فرض: `slug` و `piecesPerCarton`.
- slug در ویرایش قابل اصلاح صریح توسط نقش‌های مجاز کاتالوگ است؛ تغییر خودکار URL موجود ممنوع.
- `piecesPerCarton` editable و عدد صحیح مثبت؛ default فعلی فقط برای سازگاری حفظ شود، نه به‌عنوان مقدار محاسبه‌شده.
- تب‌ها/گروه‌های layout فاقد `name`؛ **هیچ** `general.*`، `settings.*` یا فیلد ذخیره‌شده جدیدی ایجاد نشود.
- ظاهر RTL، فوکوس، پیام خطا، اندازه کنترل و routeهای فعلی حفظ شود؛ بدون تغییر shell سراسری.
- وضعیت low-stock با آستانه دلخواه ۵۰ اضافه نشود؛ تا منبع تنظیمات معتبر موجود نیست preview به اعداد قابل محاسبه محدود بماند.

## ۴. قواعد سرور و مرز محاسبات

### ورودی معتبر

- قیمت عدد finite، صحیح و نامنفی به تومان؛ inventory عدد finite و نامنفی؛ ضریب finite و بزرگ‌تر از صفر؛ pieces عدد صحیح مثبت.
- اعتبارسنجی در مرز CSV و خود کالکشن انجام شود؛ رفتار همه مسیرهای فرم، Local API و REST یکسان باشد.
- defaultهای نمونه‌ای `500000`، `350` و `504` روی محصول جدید دیگر موجودی/قیمت ساختگی تولید نکنند: defaults عملیاتی جدید صفر برای قیمت/متراژ، کارتن محاسباتی صفر؛ رکوردهای موجود صرفاً به‌علت تغییر default بازنویسی نشوند.
- متراژ ارسالی با دقت دو رقم اعشار فعلی سفارش/انبار سازگار باشد؛ مقادیر دقیق‌تر به‌جای round خاموش، خطای روشن بگیرند. برای ضریب محدودیت دقت جدید بدون بررسی داده فعلی اعمال نشود.
- حاصل floor از تقسیم اعشاری باید با PostgreSQL NUMERIC سازگار باشد؛ `Math.floor(4.35 / 1.45)` بدون محافظت اعشاری معیار معتبر نیست. helper کوچک pure و مشترک برای preview/سرور، بدون dependency تازه و با تست مرزها کافی است.
- مقدار صفر با فقدان مقدار تفاوت دارد؛ `||` برای تشخیص فیلدهای عددی استفاده نشود.

### ساخت/ویرایش محصول

1. در update فقط فیلدهای موجود در patch با `originalDoc` ادغام شوند؛ patch قیمت نباید inventory/ضریب را undefined یا default کند.
2. `stockCartons = floor(inventorySqm / sqmPerCarton)` از مقادیر معتبر نهایی محاسبه و مقدار ارسالی جعلی آن overwrite/رد شود؛ readOnly کلاینت مبنای اعتماد نیست.
3. width/height از رابطه dimension معتبر خوانده شوند؛ اگر رابطه جدید نامعتبر است ذخیره شکست بخورد، نه حفظ ابعاد اشتباه با catch خاموش. patch نامرتبط نیازمند lookup مجدد نیست.
4. slug صریح معتبر حفظ شود؛ در update فاقد slug، مقدار موجود حفظ شود. در create از SKU نرمال‌شده ساخته شود؛ collision خطای قابل‌فهم unique بدهد و URL محصولات دیگر عوض نشود.
5. تغییر `sqmPerCarton` و `piecesPerCarton` با رزرو غیرterminal ممنوع؛ فهرست وضعیت‌های terminal از قواعد فعلی transition استخراج شود، نه حدس جدید.
6. تغییر ضریب، بررسی رزرو و محاسبه کارتن روی همان transaction و قفل ردیف محصول انجام شود. writers سفارش و محصول باید ترتیب قفل مشترک و ثابت داشته باشند.
7. updateهای صرفاً محتوایی/قیمت نباید snapshot قدیمی inventory یا carton فرم را دوباره بنویسند؛ derivedها از state معتبر/قفل‌شده ساخته شوند و no-op فیلدها شناسایی شوند.
8. تغییر dimension به snapshot تازه ابعاد همان محصول منجر شود؛ ویرایش خود رکورد dimension فعلاً bulk sync ندارد.

### رزرو و بازگردانی سفارش

- مقدار مرجع فقط `inventory_sqm` است؛ شرط کفایت بر متراژ واقعی قابل تحویل و ضریب معتبر است.
- در SQL رزرو و لغو، ابتدا مفهوم متراژ جدید طبق دقت فعلی مشخص و `stock_cartons` از همان متراژ جدید و ضریب فعلی معتبر محاسبه شود؛ کم/زیاد کردن مستقل carton حذف شود.
- این تغییر در همان session/transaction موجود `_transaction.ts` انجام شود؛ fallback غیرتراکنشی یا اتصال عمومی DB ممنوع.
- snapshot تاریخی سفارش دست‌نخورده؛ تغییر بسته‌بندی محصول با رزرو باز ممنوع است تا بازگردانی ناسازگار نشود.
- خطای validation، ACL، رزرو یا نوشتن محصول باید transaction مربوط به همان عملیات را rollback کند؛ تراکنش کل فایل ادعا نشود.

## ۵. توقف عملیاتی، بدون schema یا پنل جدید

### قرارداد توقف

از یک تنظیم deploy-time صریح، مثلاً `CMS_STOCK_WRITE_MODE=normal|manual|import` با default `normal` استفاده شود؛ نام دقیق implementation detail است، رفتار زیر ثابت است:

| حالت | مجاز | ممنوع |
|---|---|---|
| normal | سفارش عادی، محتوای محصول، قیمت، ساخت محصول بدون موجودی اولیه | جایگزینی دستی inventory، اجرای import موجودی |
| manual | ویرایش موجودی توسط یک اپراتور مجاز در فرم | import، ثبت/لغو و هر transition تغییردهنده انبار، writes سرویس به موجودی |
| import | import رسمی توسط یک اپراتور مجاز | ویرایش دستی موجودی، ساخت محصول با موجودی، رزرو/بازگردانی سفارش، دیگر writers انبار |

- guardها در مرز سرور CMS اجرا شوند تا bypass از طریق SDK/REST/Local API یا UI ممکن نباشد؛ توقف فقط در reverse proxy/API کافی نیست.
- در `import` مجوز نوشتن inventory فقط در context داخلی‌ای فعال شود که **هوک سمت سرور imports** روی request همان پردازش تنظیم کرده است؛ هیچ body/header عمومی نباید این bypass را فعال کند. propagation واقعی context پلاگین با تست integration ثابت شود.
- save قیمت/محتوا که inventory تغییر نکرده نباید به‌عنوان write موجودی بلوکه شود؛ مقدار ارسالی stale نیز نباید جایگزین شود.
- در بازه نگهداری همه replicaهای عادی نویسنده و workerهای سفارش متوقف، درخواست‌های در حال اجرا drain، و فقط یک نمونه CMS اپراتوری با حالت manual یا import فعال بماند. دو اپراتور/دو import هم‌زمان در این نسخه پشتیبانی نمی‌شوند و از دسترسی عملیاتی سرویس جلوگیری شود.
- **ترتیب runbook:** توقف و drain → تأیید نبود writer دیگر → تهیه snapshot/فایل → اعمال → بررسی گزارش و invariant → بازگرداندن حالت normal و بالا آوردن سرویس‌ها.
- فایل تهیه‌شده قبل از توقف پذیرفتنی نیست؛ سیستم سه‌ستونی نمی‌تواند کهنگی snapshot را تشخیص دهد. ادعای تشخیص خودکار فایل قدیمی ممنوع.
- اگر topology استقرار امکان انحصار نویسنده را نمی‌دهد، انتشار import متوقف شود؛ راه‌حل DB-coordinated یا نسخه‌گذاری نیازمند تصمیم جدید است، نه دور زدن شرط.

## ۶. اتصال رسمی import/export

### نسخه و پیکربندی

- نسخه نصب‌شده Payload هنگام تحقیق `3.90.2` بود؛ در آغاز اجرا با lockfile و نصب واقعی تطبیق داده شود.
- `@payloadcms/plugin-import-export` هم‌نسخه با Payload نصب شود؛ هیچ `latest` مستقل یا ارتقای ناخواسته کل خانواده Payload مجاز نیست.
- پلاگین فقط برای `products` فعال؛ sync با `disableJobsQueue: true` برای import/export و `batchSize: 100`.
- سقف محافظه‌کارانه اولیه **۱۰۰ ردیف برای هر فایل** و سقف حجم **۱ MiB**، enforce سمت سرور؛ اندازه batch تضمین timeout نیست. افزایش سقف تنها پس از benchmark محیط استقرار، بدون تغییر معماری تا زمانی که لازم نشده است.
- queues/Redis/worker تازه لازم نیست؛ بااین‌حال پلاگین taskها و collections داخلی ثبت می‌کند و اثر schema آنها بررسی شود.
- collections بومی `imports` و `exports` با overrideهای رسمی، بدون تغییر slug غیرضروری؛ گروه فارسی «کاتالوگ و انبارداری».

### کنترل imports در سرور

- در override کالکشن imports، `collectionSlug=products`، `importMode=update` و `matchField=sku` defaults و ثابت‌های قابل دیدنِ read-only باشند؛ payload مغایر در سرور رد شود، نه صرفاً پنهان در UI.
- hooks و components پیش‌فرض پلاگین حفظ شوند؛ guard/normalization قبل از شروع afterChange پلاگین انجام شود.
- ساخت import فقط در حالت `import`، CSV و توسط نقش عملیاتی انسانی مجاز؛ create/upsert، JSON و target دیگر حتی از endpoint مستقیم رد شوند.
- status/summary/creator از داده دلخواه کاربر پذیرفته نشوند؛ status اولیه معتبرِ پردازش enforced باشد. از سازوکار context/override داخلی برای update گزارش خود پلاگین استفاده شود؛ update عمومی import job ممنوع بماند.
- user اجراکننده ثبت و خواندن/دانلود فایل و گزارش محدود شود؛ مجوز collection products با مجوز فایل import/export یکی نیست.

### فایل و خطاها

- UTF-8، delimiter کاما، header دقیق سه ستون؛ ورودی صفر معتبر، خانه خالی price/inventory نامعتبر؛ اعداد دارای جداکننده هزارگان/نماد پول/NaN/Infinity رد شوند.
- BOM ابتدای header حذف شود؛ SKU صرفاً trim شود و case/صفرهای ابتدایی تغییر نکند. شماره ردیف اصلی حفظ شود.
- header ناقص/اضافی/تکراری، فایل بزرگ‌تر از سقف و SKU تکراری در فایل، خطای پیش‌بررسی کل فایل **پیش از هر write** باشند. parse اولیه با قابلیت موجود پلاگین/وابستگی موجود انجام شود؛ CSV با split(',') پردازش نشود.
- مقادیر نامعتبر ردیف، SKU ناشناخته، ACL و تعارض داده به گزارش native همان ردیف منجر شوند؛ بقیه ردیف‌ها ادامه یابند.
- برای فیلدهای مشتق `custom['plugin-import-export'].disabled=true` مفید است، اما جای allowlist سمت سرور نیست؛ ساختارهای ناشناخته یا ارسال فیلد اضافی رد شوند.
- فایل operational فقط قیمت/موجودی را تغییر دهد؛ slug، name، media، relations، isActive و بسته‌بندی باید دقیقاً حفظ شوند.
- نتیجه native `completed|partial|failed` و تعداد updated/issues مبنای نمایش باشد؛ imported باید صفر بماند. شکست ثبت گزارش پس از اعمال ردیف‌ها نیازمند reconciliation است، نه retry کور.

### export

- خروجی به‌عنوان template روزمره دقیقاً سه ستون canonical فوق باشد؛ بدون id، قیمت مشتق، metadata، media یا تنظیمات.
- CSV download بومی کافی است؛ save/export history غیرضروری محدود/غیرفعال شود اگر API رسمی پشتیبانی می‌کند؛ collection داخلی حذف دستی نشود.
- whitelist در hook خروجی مستقل از fields selector اعمال شود؛ فیلترهای محصول بومی مجاز باقی بمانند.
- formula injection در سلول SKU برای spreadsheet خنثی یا SKUهای خطرناک با خطای روشن رد شوند؛ round-trip SKU مخدوش نشود و این حالت تست شود.
- فایل‌ها در مسیر خصوصی ذخیره شوند؛ anonymous، مشتری، editor و service نباید از URL فایل هم به داده دسترسی داشته باشند.

## ۷. ماتریس مجوزها و عدم افشا

| نقش | محتوا/مشخصات | قیمت/موجودی | import/export |
|---|---|---|---|
| superadmin، manager | مطابق دسترسی فعلی | مجاز با guardهای انبار | مجاز در حالت مربوطه |
| support | مشخصات فقط مطابق مجوز قبلی؛ نه مجوز عمومی جدید | update محدود همین فیلدها | مجاز |
| editor | کاتالوگ مطابق فعلی | فقط مشاهده در ادمین، بدون ویرایش عملیاتی | ممنوع |
| service | قراردادهای داخلی موجود | فقط عملیات داخلی مجاز؛ نه bypass بازه توقف | ممنوع |
| مشتری/ناشناس/حساب غیرفعال | عمومی طبق قرارداد موجود | بدون قیمت پایه یا preview قیمت پایه | ممنوع |

- برای support، collection update به اندازه ورود به فرم و عملیات مجاز باز شود، ولی field-level/server diff allowlist از ویرایش SKU/محتوا/بسته‌بندی و create/delete غیرمجاز جلوگیری کند؛ `isCatalogManager` سراسری بی‌دلیل گسترش نیابد.
- `sqmPerCarton` و pieces همچنان تنظیمات کاتالوگ با قید رزرو هستند؛ support بدون مجوز کاتالوگ جدید به آنها دسترسی ویرایشی پیدا نمی‌کند.
- preview قیمت پایه و اصل `basePricePerSqm` به context ادمین/سرویس معتبر محدود شوند؛ public CMS read نیز آزمایش شود، نه فقط API mapper.
- اگر حفاظت قیمت پایه برای catalog API به اصلاح محدود احراز هویت service نیاز داشت، فقط همان seam اصلاح شود؛ جایگزینی کل DTO یا تغییر zod قرارداد خارج از دامنه است.

## ۸. توالی اجرا و checkpointها

### P0 — baseline و آماده‌سازی

1. `git status --short`، diff و فایل‌های untracked مرتبط را بررسی؛ تغییرات کاربر حفظ شوند.
2. نسخه‌های واقعی، scripts، migration registry، تنظیمات deploy و jobها خوانده شوند؛ از `.env` یا secret در خروجی کپی نشود.
3. baseline typecheck و تست‌های موجود ثبت شوند؛ screenshot فرم فعلی، payload نمونه و ستون‌های جدول products در DB آزمایشی تهیه شود.
4. blockers قبلی، به‌ویژه order creation با ID رشته‌ای، بازتولید شوند. اگر مانع اثبات رزرو واقعی است، اصلاح حداقلی نوع ID در همان مرز با تست مجاز است؛ بازسازی کامل سفارش/قرارداد مجاز نیست.

**خروج:** فهرست baseline failure جدا از regression؛ هیچ اجرای destructive روی DB واقعی.

### P1 — invariant محصول و موجودی

1. helper کوچک محاسبات/اعتبارسنجی با تست node:test موجود اضافه شود.
2. hook محصول patch-safe، slug-safe و dimension-safe شود؛ derived fields سرور-authoritative شوند.
3. قفل محصول و guard بسته‌بندی با رزرو باز اضافه/تکمیل شود.
4. رزرو/لغو SQL از متراژ مرجع carton را بازمحاسبه کند.
5. محدودیت‌های نقش عملیاتی و modeهای توقف روی همه writers اضافه شوند؛ خطاهای قابل‌فهم فارسی و کد قابل‌آزمون داشته باشند.

**خروج:** تست pure و PostgreSQL برای سازگاری فرم/سفارش؛ هیچ راهی برای stockCartons مستقل وجود نداشته باشد.

### P2 — فرم محصول

1. `products.collection.ts` به دو تب بدون نام بازچینی شود.
2. preview بومی ui و read-onlyهای دقیق پیاده شوند؛ فایل‌های جدید kebab-case و named export.
3. تغییر ضریب/قیمت/موجودی در فرم بدون ذخیره preview را به‌روز کند؛ کنترل‌های حقیقی سرور صرفاً بعد ذخیره معتبر شوند.
4. فیلدهای ذخیره‌شده، مسیرها و API response shape قبل/بعد مقایسه شوند.

**خروج:** تأیید بصری RTL و آزمون کامل create/edit با خطاهای validation و نقش‌ها.

### P3 — پلاگین و فایل عملیاتی

1. وابستگی هم‌نسخه و registration محدود محصولات اضافه شود.
2. override رسمی ACL، mode/match/target، پیش‌بررسی فایل و hooks allowlist اضافه شود؛ pipeline سفارشی نوشته نشود.
3. export سه‌ستونی و حفاظت فایل‌ها فعال شود.
4. گزارش native، partial success و حفظ fieldهای خارج از دامنه با Local API و مرورگر آزموده شود.

**خروج:** CSV واقعی دو ردیف سالم + یک خطای ردیف، بدون ساخت محصول جدید و با گزارش قابل تطبیق.

### P4 — migration، داده موجود و rollout آزمایشی

1. types/importmap فقط با generator تولید شوند؛ routeTree/types/map دستی ویرایش نشوند.
2. migration افزایشی PostgreSQL برای schema نهایی پلاگین تولید و SQL آن بازبینی شود؛ DROP/RENAME ستون محصول و تغییر API field path ممنوع.
3. روی داده نمونه، گزارش read-only از factor نامعتبر، موجودی منفی/دقیق‌تر از دو رقم، slugهای مفقود، و اختلاف carton با floor تهیه شود.
4. داده مبهم به‌صورت خودکار از carton یا dimension حدس زده نشود؛ پاک‌سازی destructive نیازمند تأیید انسانی جدا است.
5. برای رکوردهای سالم، backfill کنترل‌شده `stock_cartons` از inventory/factor در بازه توقف، در transaction و با گزارش تعداد اجرا شود. ردیف نامعتبر موجب توقف backfill/rollout شود؛ skip خاموش ممنوع.
6. migration schema و backfill از هم جدا و rerunnable/idempotent باشند؛ export backup و count قبل/بعد نگه داشته شود.
7. در DB disposable migration از baseline و boot مجدد بررسی شود؛ نوع/ستون‌های products و داده اصلی ثابت بمانند.

**خروج:** migration افزایشی بازبینی‌شده، داده سازگار و تست boot/rollback عملیاتی؛ اجرای production نیازمند مجوز مستقل.

### P5 — اسناد و تحویل

اسناد موجود، نه README جدید، فقط در بخش‌های متأثر اصلاح شوند:
- `docs/01-domain-models.md`: مالکیت متراژ، carton مشتق ذخیره‌شده، pieces مستقل و URL پایدار.
- `docs/02-business-rules.md`: partial import، بازه توقف، guardهای انبار، مجوز و فرمول دقیق.
- `docs/03-system-flows.md`: مسیر official import و شکست جزئی به‌جای تراکنش کل فایل.
- `docs/04-roles-and-permissions.md`: نگاشت نقش‌های واقعی تأییدشده.
- `docs/06-admin-and-operations.md`: فرم دو‌تب، template، سقف فایل، توقف/drain، رفع خطا و بازگشت به سرویس.
- پلن‌های قدیمی به‌عنوان سابقه بازنویسی نشوند؛ در اسناد جاری تصمیم جدید و علت جایگزینی مشخص شود.

**خروج:** گزارش دقیق modified files، آزمون‌های اجراشده/skipشده و محدودیت‌های باقی‌مانده؛ build-only به‌عنوان «کار می‌کند» گزارش نشود.

## ۹. ماتریس آزمون پذیرش

| گروه | حداقل سناریو و نتیجه |
|---|---|
| محاسبه | 504/1.44 → 350؛ صفر؛ موجودی کمتر از یک کارتن؛ 4.35/1.45 → 3؛ اعداد نزدیک مرز؛ صفر/منفی/NaN factor رد؛ برابری helper با SQL numeric. |
| patch | فقط قیمت، فقط inventory، فقط factor، مقدار صفر، نامرتبط، stockCartons جعلی، width/height جعلی؛ فیلدهای omitted حفظ شوند. |
| slug | create خودکار، slug صریح، SKU-only update، حفظ URL قبلی، برخورد unique، فارسی/NFKC؛ SKU موجود با PATCH تغییر نکند. |
| بسته‌بندی | تغییر ضریب با رزرو باز رد؛ رقابت reserve × packaging-edit serialized؛ پس از terminal مطابق policy مجاز؛ pieces هرگز از مساحت حدس نشود. |
| سفارش واقعی | ساخت سفارش، کاهش متراژ/کارتن مشتق، لغو و بازگردانی دقیق، لغو تکراری، rollback، چندمحصولی و ترتیب قفل؛ نه فقط mock SQL. |
| mode | normal: import و stock overwrite رد؛ manual: import/order-stock رد؛ import: manual/order/service-stock رد؛ قیمت/محتوای عادی بی‌جهت مسدود نشوند. |
| stale save | فرم محتوایی باز قبل از سفارش، سپس سفارش و save محتوا؛ موجودی کسرشده برنگردد. |
| import mode | create/upsert، target دیگر، matchField=id، status/summary جعلی، JSON و دسترسی مستقیم رد؛ SKU ناشناخته محصول نسازد. |
| فایل | header ناقص/اضافی/تکراری، BOM، SKU تکراری، empty، 101 ردیف، >1MiB، blank numeric، صفر، scientific/nonfinite و جداکننده هزارگان؛ شماره ردیف درست. |
| نتیجه | ردیف سالم + خراب → partial، سالم پابرجا؛ imported=0؛ همه خطا → failed؛ همه سالم → completed؛ retry کنترل‌شده همان نتیجه را بدون دست‌زدن به metadata غیرعملیاتی بدهد. |
| حفاظت | anonymous/customer/editor/service export/import و URL فایل ممنوع؛ حساب inactive ممنوع؛ قیمت پایه/preview در پاسخ مشتری و CMS عمومی ظاهر نشود. |
| نقش support | قیمت/موجودی مجاز در mode درست، ولی patch نام/SKU/بسته‌بندی/create/delete غیرمجاز رد؛ editor فقط کاتالوگ. |
| سازگاری | نام فیلدهای flat و snapshot سفارش ثابت؛ response محصول کلید نمایشی جدید نداشته باشد؛ تصاویر/slug/روابط پس از CSV بدون تغییر. |
| UI | دو تب دقیق، محاسبه زنده، حالت نامعتبر، read-only واقعی، پیام نیاز به توقف برای inventory، صفحه کوچک، RTL، keyboard/focus و خطای required در تب دوم قابل دسترس. |
| استقرار | توقف و drain، یک writer، فایل پس از توقف، import، تطبیق summary/invariant و بازگشت normal در محیط آزمایشی واقعاً اجرا شود. |

### فرمان‌ها؛ از باریک‌ترین بررسی به بیرون

در شروع scripts واقعی بازخوانی شوند. نمونه‌های موجود/هدف:

```bash
pnpm --filter @persianpart/cms exec tsc --noEmit
pnpm --filter @persianpart/cms test:hardening
pnpm --filter @persianpart/cms test:hardening:postgres
pnpm --filter @persianpart/cms test:hardening:migrations
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm check-types
pnpm build
```

- تست‌های جدید focused با runner فعلی `tsx --test`/`node:test` و assert نوشته و به script متناسب افزوده شوند؛ Vitest/چارچوب تازه نصب نشود.
- lint مستقل هنگام تحقیق تأیید نشده؛ scripts/config دوباره بررسی شود، و اگر واقعاً وجود نداشت صریح ثبت شود، نه فرمان ساختگی.
- `test:hardening:postgres` بدون `CMS_TEST_DATABASE_URI` ممکن است skip شود؛ skip دلیل موفقیت نیست.
- DB integration باید disposable باشد: شرط فعلی localhost/port صریح/`cms_hardening_test` و عملیات truncate رعایت شود.
- تست migrations فعلی port `55483` و create/drop DB دارد؛ پیش از اجرا setup/target بررسی شود، روی DB مشترک/واقعی اجرا نشود.
- frontend smoke با ابزار مرورگر/Playwright موجود، نه فقط curl/build؛ screenshot و summary مشاهده‌شده ثبت شود.

## ۱۰. rollback و معیار توقف

- قبل rollout، backup DB و فایل‌ها؛ deploy هم‌نسخه همه اجزای CMS.
- اگر invariant یا ACL یا transaction fail شد، حالت توقف حفظ و import بسته بماند؛ سرویس سفارش به وضعیت مشکوک باز نشود.
- migration افزایشی در rollback کد لازم نیست فوراً down شود؛ حذف جدول‌ها/فایل‌های import داده از بین می‌برد و بدون مجوز ممنوع است.
- **rollback کد، ردیف‌های موفق import را برنمی‌گرداند.** جبران از backup/فایل پیشین فقط در همان بازه توقف و پس از تشخیص عدم وجود سفارش جدید انجام شود؛ پس از ازسرگیری سفارش، replay خودکار موجودی قدیمی ممنوع و reconciliation انسانی لازم است.
- شکست report update، timeout یا قطع ارتباط، نتیجه عملیات را نامعلوم می‌کند؛ قبل retry رکورد imports، گزارش‌ها و وضعیت ردیف‌ها بررسی شوند.
- توقف و ارجاع مجدد لازم است اگر: نسخه پلاگین سازگار نبود، context داخلی قابل اعتماد نبود، topology انحصار writer را تضمین نکرد، داده نامعتبر migration را مبهم کرد، یا رفع blocker سفارش نیازمند تغییر قرارداد عمومی/بازسازی subsystem شد.

## ۱۱. معیار پایان

- [ ] تصمیم‌های جدول بخش ۱ در کد و اسناد جاری منطبق هستند.
- [ ] فرم دو‌تب و preview فقط UI؛ products flat و schema محصول بدون تغییر مخرب.
- [ ] انبار متراژمرجع در فرم، import، رزرو و لغو یکسان است؛ هیچ stockCartons مستقل writable نیست.
- [ ] update-only روی SKU و فایل سه‌ستونی در سرور enforced؛ imported همیشه صفر.
- [ ] partial success، حالت توقف، ACL فایل و عدم افشای قیمت پایه با تست واقعی اثبات شده‌اند.
- [ ] migration افزایشی و backfill در DB disposable آزمایش و داده مبهم گزارش شده است.
- [ ] baseline failure، skip و موارد حل‌نشده جدا از نتیجه این تغییر گزارش شده‌اند.
- [ ] هیچ worker، global تنظیماتی، صفحه admin جایگزین، DTO تازه یا importer موازی بی‌نیاز اضافه نشده است.

## منابع رسمی بررسی‌شده

- https://payloadcms.com/docs/plugins/import-export
- https://payloadcms.com/docs/fields/tabs — tab نام‌دار داده را nested می‌کند؛ label-only صرفاً layout است.
- https://raw.githubusercontent.com/payloadcms/payload/v3.90.2/packages/plugin-import-export/src/index.ts
- https://raw.githubusercontent.com/payloadcms/payload/v3.90.2/packages/plugin-import-export/src/import/batchProcessor.ts — matchField برای update، `overrideAccess:false`، transaction مستقل عملیات و ادامه پس از خطای ردیف.
- https://raw.githubusercontent.com/payloadcms/payload/v3.90.2/packages/plugin-import-export/src/import/getFields.ts — فیلدهای واقعی mode/match/summary.
- https://raw.githubusercontent.com/payloadcms/payload/v3.90.2/packages/plugin-import-export/src/import/getImportCollection.ts — hooks، sync/queue و گزارش native.

**نکته شواهد:** در مرحله طراحی هیچ build، test یا migration اجرا نشده است؛ بررسی کد و مستندات جای اثبات runtime مرحله اجرا را نمی‌گیرد.
