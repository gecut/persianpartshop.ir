# پلن اجرایی CMS — ساختار، امنیت و تمامیت داده

وضعیت: آمادهٔ اجرا با گیت‌های توقف. این سند مجوز تغییر UI یا حذف داده نیست.
قالب مستقل با تأیید کاربر؛ `writing-for-agents` در مسیرهای بررسی‌شده موجود نبود.
مسیر مقصد درخواستی: `.agents/brain/cms-hardening-plan.md`. نوشتن در این مسیر در Plan Mode رد شد؛ سند فعلاً در مسیر مجاز `.kilo/plans/1793085402912-cms-hardening-and-structure.md` است. عامل دارای مجوز باید پیش از اجرا آن را به مقصد منتقل کند؛ محتوای منتقل‌شده همان پلن اصلی باشد، نه نسخهٔ متفاوت.

## 1. هدف و شواهد

اصلاح نواقص اثبات‌شدهٔ سورس CMS، منظم‌کردن collectionها، حفظ اتصال API و قرارداد مصرف‌کننده‌ها. بررسی سورس انجام شده؛ build، DB، concurrency و browser verification تازه انجام نشده‌اند. هیچ P0 اثبات نشده است. مسیر/خط‌های زیر قبل از rename هستند و باید با revision فعلی تطبیق داده شوند.

| ID | اهمیت | شاهد و نقص | معیار بسته‌شدن |
|---|---|---|---|
| F01 | P1 | CRUD عمومی: `apps/cms/src/collections/Users.ts:15`، `Products.ts:16`، `Orders.ts:20` | تست ACL و منع PII/عملیات بدون مجوز |
| F02 | P1 | مبلغ و مقدار ارسالی authoritative: `apps/cms/src/collections/hooks/orders/calculate-order-totals.ts:34` | محاسبهٔ سروری، validation و snapshot immutable |
| F03 | P1 | stock مستقل از order، خطای بلعیده‌شده و clamp کمبود: `apps/cms/src/collections/hooks/orders/sync-inventory-on-change.ts:33` | rollback کامل و تست کمبود/رقابت |
| F04 | P1 | reopen و item edit موجب فساد رزرو | transition اتمیک و restore دقیقاً یک‌بار |
| F05 | P1 | retry write بدون dedup: `apps/cms/src/sdk.ts:71` | read retry امن و idempotency یکتا |
| F06 | P1 | baseline ناسازگار با schema و `push:false` | migration از DB خالی و baseline قبلی |
| F07 | P1 | role/isActive بدون enforcement: `apps/cms/src/collections/Admins.ts:14` | منع escalation و inactive login/session |
| F08 | P1 مشروط به استقرار | fallback secrets در CMS/API/compose | runtime بدون secret معتبر شروع نشود؛ rotate در صورت استفادهٔ واقعی |
| F09 | P2 | order number ناپایدار؛ PATCH مالی ناسازگار | شماره ثابت و محاسبات immutable |
| F10 | P2 | seed موجودی را reset می‌کند؛ plan برای گیرنده اول ذخیره می‌شود | seed repeatability و isolation گیرنده |
| F11 | P2 | API-key برای users غیر auth؛ selection روی number input | هویت ماشین معتبر و بررسی مرورگر با مجوز UI |
| F12 | P3 | slug collision برای SKUهای متفاوت | normalization و collision handling پایدار |

ردشده: نبود unique شماره سفارش، recursion بی‌نهایت hook، restore در هر لغو تکراری، upload عمومی Media به‌صورت پیش‌فرض و staleبودن کامل generated types. exploit فایل مخرب و compromise واقعی secret اثبات نشده‌اند.

API اکنون REST SDK بدون credential دارد (`apps/api/src/payload.ts:1`، `apps/cms/src/sdk.ts:153`)؛ بستن CMS به‌تنهایی API را می‌شکند. API محصول کامل/markup را spread می‌کند (`apps/api/src/routers/router.helpers.ts:106`)، checkout قدیمی موازی دارد و `verifyPayment` تأیید مالی واقعی انجام نمی‌دهد. اسناد gateway آنلاین را خارج از دامنه می‌دانند.

## 2. قید مطلق: UI قفل است

**ظاهر و تعامل وب و پنل CMS تحت هیچ شرایطی بدون تأیید صریح و جزئی کاربر تغییر نکند. این قید بر تمام مراحل و تصمیم‌های قبلی مقدم است.**

شامل: layout، رنگ، فونت، فاصله/اندازه، responsive/RTL، متن/label، ترتیب و نمایش fieldها، navigation، کنترل‌ها، disabled/read-only، پیام خطا/موفقیت، modal، loading/empty state و رفتار قابل مشاهده.

تغییر schema، ACL، DTO یا hook نیز می‌تواند UI را غیرمستقیم عوض کند. نام «رفع باگ»، «امنیت» یا «refactor» معافیت نیست. اصلاح بک‌اند بدون اثر UI مجاز است؛ اثر دیداری/تعاملی نیازمند تأیید مستقل است.

### پروتکل مجوز UI

1. بخش دارای احتمال تغییر UI را متوقف کن؛ فقط کار مستقل و بدون اثر UI ادامه یابد.
2. صفحه/مسیر، نقش، وضعیت و کنترل فعلی را با تصویر مرجع و سناریوی بازتولید مشخص کن.
3. تک‌تک تغییرات قبل/بعد، متن دقیق، رفتار، اثر روی نقش‌ها، RTL و viewportها را شرح بده؛ گزینهٔ بدون تغییر UI را نیز بیان کن.
4. برای همان تغییرات تأیید صریح بگیر. سکوت، تصویب کلی پلن یا تصمیم تجاری قبلی مجوز UI نیست.
5. فقط دامنهٔ تأییدشده را اجرا و با baseline مقایسه کن؛ اختلاف تازه دوباره مجوز می‌خواهد.

نقاط توقف شناخته‌شده: field مخفی/read-only ناشی از ACL، collection جدید ماشین در navigation ادمین، نمایش snapshot/idempotency در فرم، حذف قیمت پایه از UI، تغییر status/control، پیام پرداخت، متن شخصی‌سازی plan، تعامل ورودی عدد فارسی و upload. اثر UI هیچ‌یک هنوز مجاز نشده است.

در تعارض امنیت و UI، rollout بخش مربوط متوقف شود؛ نه مجوز امنیت دور زده شود، نه UI خودسرانه تغییر کند.

## 3. تصمیم‌های تثبیت‌شده

- یک پوشه برای هر collection با `index.ts` barrel. نام فایل/پوشه `kebab-case`؛ متغیر/تابع `camelCase`؛ کامپوننت/type/interface `PascalCase`.
- فایل داخلی با `_`؛ hook با phase واقعی، مثل `_personalize-plan.after-read.ts`. barrel فقط collection config؛ internal import مستقیم، بدون cycle.
- framework filenames، generated files، migration identity، slug، کلید DB/API، public exports و media URL محفوظ‌اند.
- CMS مرجع قیمت، snapshot، lifecycle و inventory. API مالک customer auth، ownership و orchestration؛ اتصال REST با scoped machine identity.
- lifecycle: `pending → approve → completed`؛ لغو terminal. مشتری فقط pending خود تا ۳۰ دقیقه؛ کارکنان مجاز پیش از completed. reopen/delete و item/price edit پس از create ممنوع؛ اصلاح از مسیر cancel + new order.
- catalog خصوصی B2B؛ فقط قیمت نهایی برای مشتری، نه base/markup. tier pricing فعلی؛ plan اطلاع‌رسانی؛ tax/discount صفر تا سیاست جدید؛ موتور تخفیف ساخته نشود.
- `inventorySqm` موجودی قابل فروش مرجع؛ `stockCartons = floor(inventorySqm / sqmPerCarton)` مشتق؛ رزرو بر deliverable area؛ packaging edit با reservation غیرterminal ممنوع.
- PostgreSQL تنها DB در توسعه/تست/تولید. دادهٔ فعلی دورریختنی است، ولی reset نیازمند تأیید جداگانهٔ مقصد دقیق است. corrective migration و حفظ تاریخچه پیش‌فرض.
- superadmin همه/مدیریت ادمین؛ manager کاتالوگ/مشتری/سفارش/plan؛ editor کاتالوگ/مدیا؛ support مشاهدهٔ مشتری/سفارش و یادداشت. inactive مانع login و session قبلی؛ ماشین هرگز superadmin نیست.

## 4. ساختار مقصد

```text
apps/cms/src/
  collections/
    admins/{index.ts,admins.collection.ts,_is-active.before-login.ts}
    users/{index.ts,users.collection.ts}
    customer-types/{index.ts,customer-types.collection.ts}
    media/{index.ts,media.collection.ts}
    categories/{index.ts,categories.collection.ts}
    brands/{index.ts,brands.collection.ts}
    dimensions/{index.ts,dimensions.collection.ts}
    tags/{index.ts,tags.collection.ts}
    products/
      index.ts
      products.collection.ts
      _sync-slug-and-dimensions.before-validate.ts
    orders/
      index.ts
      orders.collection.ts
      _prepare-order.before-validate.ts
      _apply-reservation.before-change.ts
      _validate-transition.before-change.ts
    plans/
      index.ts
      plans.collection.ts
      _personalize-plan.after-read.ts
  access/
  migrations/
  app/
  payload.config.ts
  payload-types.ts
  payload.ts
  sdk.ts
  seed.ts
```

درخت مسئولیت را نشان می‌دهد، نه الزام فایل بی‌مصرف. phase با نسخه نصب‌شده تطبیق یابد. test/helper اختصاصی کنار collection و با پیشوند داخلی. `access/` فقط منطق مشترک واقعی؛ catch-all utils و لایه‌های service/repository حدسی ممنوع. `collections/hooks/` پس از انتقال importها حذف شود.

## 5. مراحل مرتب اجرا

### T01 — baseline و refactor مکانیکی

- revision، git status، تغییرات کاربر و نسخه‌های lockfile را ثبت کن. مبنای بررسی Payload 3.90.2، Next 16.3.8، oRPC 2.0.0-beta.42 بوده؛ دوباره تطبیق بده.
- baseline typecheck/build و screenshot/interaction وب/CMS را با fixture، نقش، viewport و RTL ثابت ثبت کن. نبود محیط مشاهده یعنی حفظ UI هنوز قابل اثبات نیست.
- پوشه/barrel/filename مصوب و importها را هماهنگ کن؛ refactor از تغییر رفتار جدا باشد. framework/export/route/media محفوظ.
- خروجی: import سالم، diff مکانیکی قابل بررسی و UI بدون اختلاف. بدون درخواست commit نکن.

### T02 — هویت ماشین و ACL

- machine identity مجزا با API-key رسمی Payload و least privilege؛ secret سروری با provisioning جدا از seed عمومی. collection prefix SDK اصلاح و مسیر `users API-Key` حذف شود.
- API قبل از lockdown credential معتبر داشته باشد؛ deploy هماهنگ یا fail-closed، نه public fallback.
- collection/field ACL و active state؛ هویت براساس collection + role، نه role string تنها؛ منع escalation و bootstrap عمومی پس از اولین superadmin.
- actor/owner مشتری قابل اعتماد نیست؛ API پس از auth ارسال، CMS active customer و ownership/deadline را recheck کند.
- secrets placeholder و DB URI نامعتبر runtime را متوقف کنند. build-only config راه fallback runtime نسازد. در صورت استفادهٔ واقعی، credential افشاشده rotate و session مرتبط invalidate؛ secret چاپ نشود.
- پذیرش: ACL matrix و API→CMS امن. اثر navigation/form/field از گیت UI عبور کند.

### T03 — سفارش authoritative و stock اتمیک

- فقط product ID و requestedArea مثبت/finite مبنای ورودی؛ خطوط تکراری تجمیع؛ active customer/tier/product و packaging معتبر؛ computed input override/reject؛ lookup شکست‌خورده خطا دهد، نه default جادویی.
- tier formula فعلی در CMS؛ whole cartons، precision ثابت متراژ، integer/safe تومان و rounding صریح. epsilon و clamp برای مخفی‌کردن کمبود ممنوع.
- snapshot محصول/packaging/مبنای قیمت/مبلغ immutable؛ pricing basis داخلی در DTO مشتری نیاید؛ field جدید بدون مجوز روی UI ظاهر نشود.
- یک transaction برای order/stock/history؛ `req` مشترک، await و propagation خطا الزامی.
- row محصول در ترتیب ثابت ID و همان transaction قفل، stock کافی بررسی و balance کم شود. adapter/Drizzle نسخه‌مطابق؛ transaction تنها جلوی lost update را نمی‌گیرد. conditional atomic update فقط با affected-row check و transaction مشترک جایگزین مجاز است.
- stock edit و packaging edit همین مرز را رعایت کنند؛ packaging با reservation غیرterminal ممنوع؛ stockCartons مستقل writable نباشد. اثر فرم/read-only نیازمند مجوز UI.
- idempotency scoped مشتری/عملیات، key پایدار، fingerprint نرمال و unique DB constraint: replay یکسان نتیجه قبلی، payload متفاوت conflict؛ race و isolation تست شود. API/web key را در retry حفظ و برای intent جدید تازه کنند، بدون تغییر UI.
- SDK فقط safe read را retry کند؛ write بدون idempotency retry نشود. شماره سفارش collision-resistant، create-only و ثابت در PATCH؛ unique حفظ و after-create renumber زائد حذف شود.
- پذیرش: shortage رد؛ failure قلم دوم rollback کامل؛ replay یک order/deduction؛ race از stock بیشتر نفروشد.

### T04 — lifecycle و اتصال API/web

- transition مصوب در CMS برای REST/Admin enforce؛ item/customer/money immutable؛ delete/reopen ممنوع؛ legacy cancel با actor معتبر normalize.
- transition روی row order serialize؛ restore از reserved snapshot دقیقاً یک‌بار، با ترتیب lock ثابت؛ رقابت cancel/completion امن؛ completed عادی restore نکند.
- timeline actor/time/from/to سروری؛ note پشتیبانی جدا از fieldهای محافظت‌شده.
- `order.submit` و `shopping.createOrder` از یک مرجع CMS استفاده کنند؛ pricing duplication حذف، پاسخ committed؛ ownership/customer-only در API حفظ.
- catalog و shopping legacy خصوصی؛ DTO allowlist بدون base/markup/private relations؛ contractهای درگیر از `z.any()` آزاد و mapping داخلی وب سازگار شود، بدون تغییر UI. هر اختلاف UI توقف ایجاد کند.
- gateway ساخته نشود؛ `verifyPayment` نباید ادعای تأیید جعلی کند. caller بررسی و تغییر پیام/flow پیش از اجرا تأیید جزئی بگیرد؛ بخش وابسته بدون مجوز rollout نشود.
- پذیرش: lifecycle و exact-once درست، DTO محرمانه و قرارداد مصرف‌کننده محفوظ.

### T05 — plan، seed، slug، ورودی و مدیا

- plan template دست‌نخورده؛ read برای گیرندهٔ مجاز؛ canonical برای admin edit. تغییر متن نمایشی از گیت UI عبور کند. unsupported fixture commercial fields حذف، نه ساخت discount engine.
- seed development-only با fixture identity ثابت، target صحیح، بدون reset stock/duplicate، lifecycle معتبر؛ اجرای دوم وضعیت معنایی یکسان بدهد.
- number input فارسی: selection نامعتبر رفع و controlled-form event درست؛ تغییر تعامل ابتدا مجوز UI.
- explicit slug محفوظ؛ Unicode normalization + suffix پایدار SKU و collision handling؛ punctuation/Persian/concurrency تست؛ محدودکردن alphabet تجاری بدون تأیید ممنوع.
- media ACL و policy تصویر/۱۵ MB طبق اسناد، محتوای واقعی با ابزار موجود؛ مسیر upload مستقیم API نیز پوشش داده شود. URL/volume محفوظ؛ پیام/preview/interaction با گیت UI. exploit اثبات‌نشده ادعا نشود.
- پذیرش: isolation، repeatability، slug و upload تست‌شده؛ موارد UI بدون مجوز صریح باز بمانند.

### T06 — migration و rollout

- SQLite config/dependency حذف. corrective migration schema نهایی: dimensions/customer-types، username قدیمی، order enum/fields/timeline، snapshot، idempotency و ماشین.
- SQL/index/constraint را بررسی؛ applied migration بازنویسی/rename نشود. legacy مبهم توقف ایجاد کند؛ snapshot/history ساختگی ممنوع.
- DB خالی و baseline قبلی روی DB مستقل تست؛ reset یا `migrate:fresh` فقط با تأیید مقصد دقیق.
- type/import map با generator، نه ویرایش دستی.
- credential API + ACL + schema هماهنگ rollout؛ API قدیمی unauthenticated در ترافیک نماند؛ rollback فقط سازگار با schema؛ down مخرب مالی پیش‌فرض نیست.
- پذیرش: migration/CRUD و API→CMS موفق، smoke و baseline UI بدون اختلاف تأییدنشده.

## 6. Validation و recheck

ابزار: tsx نصب‌شده + `node:test`/assert؛ framework تازه اضافه نشود. DB تست مستقل؛ SMS واقعی یا DB مشترک استفاده نشود.

- ACL: anonymous/customer/service/تمام staff، PII، escalation، inactive login/session، bootstrap.
- order: جعل مبلغ، منفی/کارتن کسری، NaN/extreme، tier/product نامعتبر، duplicate lines، rounding، snapshot immutable.
- concurrency: دو order فراتر از stock، failure چندقلم، replay هم‌زمان، cancel هم‌زمان، packaging/stock-edit race.
- lifecycle: منع reopen/edit/delete، شماره ثابت PATCH، key یکسان با payload متفاوت، intentهای مستقل یکسان با key متفاوت.
- DTO: base/markup/internal snapshots غایب؛ shape لازم مصرف‌کننده باقی.
- عملیات: seed دوباره؛ fresh/upgrade migration؛ media auth/type/size؛ slug فارسی/نشانه؛ عدد فارسی browser-save فقط پس از مجوز لازم.
- UI: screenshot و interaction قبل/بعد با داده/نقش/viewport/RTL ثابت؛ اختلاف تأییدنشده قابل پذیرش نیست. snapshot مرجع را برای پنهان‌کردن regression خودکار به‌روزرسانی نکن.

دستورهای موجود را با manifest دوباره بررسی و اجرا کن:

```bash
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm check-types
pnpm build
```

دستور persistent tests اضافه‌شده ثبت شود. lint در manifest بررسی‌شده تنظیم نبود؛ اگر اکنون وجود دارد اجرا، وگرنه «تنظیم نشده» گزارش، نه «قبول». نصب lint بی‌درخواست خارج از دامنه.

هر F01–F12: شاهد فعلی، تست regression، نتیجهٔ recheck مستقل و وضعیت `fixed / blocked / unverified / rejected`. build موفق معادل صحت یا حفظ UI نیست.

## 7. توقف، تحویل و خارج از دامنه

توقف اجباری: تغییر UI بدون مجوز جزئی، ابهام تجاری مؤثر، drift DB واقعی، نبود محیط تست لازم، نیاز reset/credential واقعی، شکست atomicity/ACL یا ناسازگاری ابزار. بخش مستقل می‌تواند ادامه یابد، نه بخش وابسته.

تحویل: فهرست تغییرات، یافته‌های بسته/باز، شواهد تست و محدودیت‌ها، migration/rollout و فهرست مجوزهای UI با دامنهٔ دقیق. بدون مجوز یا verification، تکمیل سراسری ادعا نشود.

خارج از دامنه: workflow کامل چندمرحله‌ای اسناد، CSV importer، payment gateway، tax/plan-discount engine، OTP/revocation-store redesign، rename کل repo، هر redesign UI و معماری speculative. OTP ریسک جدا و رفع‌نشده گزارش شود. اصلاح API/وب فقط برای مرزهای مصوب و تابع قفل UI است.
