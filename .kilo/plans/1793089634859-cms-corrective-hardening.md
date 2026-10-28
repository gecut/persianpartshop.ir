# پلن فعال: collection سادهٔ OTP در Payload

> **به‌روزرسانی (2026-10-28):** بخش «حالت نگهداری موجودی» (`CMS_STOCK_WRITE_MODE`) در اصلاحیهٔ CMS این سند با `1793189543145-production-inventory-simplification.md` منسوخ شد؛ موجودی مقدار مطلق بدون بازه نگهداری است.

این بخش درخواست فعلی است؛ بخش اصلاحیهٔ CMS در ادامه صرفاً سابقه است و مجوز اجرای دوبارهٔ آن نیست.

## هدف و تصمیم‌های قطعی

- جایگزینی Map حافظه‌ای `apps/api/src/lib/otp.ts` با یک collection پایدار PostgreSQL در Payload؛ نه SQL TEMP TABLE.
- بدون Redis، code hash، رمزگذاری، سرویس جدید یا تغییر فرم مشتری. کد به‌صورت متن ساده ذخیره می‌شود و فقط مدیرکل فعال آن را می‌خواند. در نتیجه خوانندهٔ DB/backup نیز به کد دسترسی دارد؛ این محدودیت طراحی انتخاب‌شده است.
- سیاست فعلی حفظ شود: کد ۴رقمی، اعتبار ۱۲۰ ثانیه، cooldown برابر ۶۰ ثانیه، حداکثر ۵ تلاش اشتباه. تولید با `crypto.randomInt(1000, 10000)`؛ کد در log، پاسخ مشتری، token یا export قرار نگیرد.
- مجوز UI محدود به اضافه‌شدن collection OTP و مشاهدهٔ read-only شماره/مشتری، کد، زمان و تلاش‌ها توسط superadmin است؛ وب و سایر پنل تغییر نکنند. احراز مجدد، reveal button و audit subsystem در این نسخه ساخته نشوند.

## ساختار و مالکیت

1. `apps/cms/src/collections/otps/{index.ts,otps.collection.ts}` مطابق الگوی موجود؛ helper/hook فقط در صورت نیاز واقعی کنار collection. slug ثابت `otps`.
2. فیلدها:
   - `user`: رابطهٔ required با `users`، unique؛ یک رکورد برای هر مشتری.
   - `phone`: متن required و unique، شمارهٔ نرمال‌شدهٔ `09xxxxxxxxx`؛ از مشتری مرتبط استخراج و تطبیق داده شود، نه اعتماد به ورودی عمومی.
   - `code`: متن nullable برای کد فعال؛ ۴ رقم انگلیسی. هنگام ابطال/مصرف null شود.
   - `expiresAt`: زمان required با timezone.
   - `cooldownUntil`: زمان required برای جلوگیری از دورزدن cooldown پس از مصرف.
   - `attempts`: عدد صحیح required، پیش‌فرض صفر و بازهٔ صفر تا پنج.
   - timestamps استاندارد Payload؛ فیلدهای دیگر اضافه نشوند.
3. `code=null` یعنی رکورد فقط محدودیت درخواست را نگه می‌دارد، نه OTP فعال. status/consumed flag اضافی لازم نیست.
4. read فقط هویت `admins` با role=superadmin و `isActive===true`. create/update/delete عمومی و ادمین ممنوع؛ عملیات فقط از command داخلی ماشین مجاز انجام شوند. حساب service حق list/detail/export کدها را نداشته باشد. صرف `admin.readOnly` جای ACL را نمی‌گیرد.
5. collection از import/export plugin، population مشتری در پاسخ عمومی و هر پاسخ عمومی auth کنار گذاشته شود. code در پاسخ ordinary REST مشتری یا ماشین ظاهر نشود؛ فقط command صدور اختصاصی آن را برای ارسال SMS به API برگرداند.

## ترتیب اجرا

### ۱. collection، ACL و migration

- نسخه‌های نصب‌شده، config واقعی، machine credential و hook/transaction API بررسی شوند؛ ادعاهای قبلی تکمیل امنیت، مبنا قرار نگیرند.
- collection و ACL ثبت؛ عنوان «کدهای ورود»، ستون‌های مشتری/شماره، کد، انقضا و تلاش‌ها؛ بدون کنترل ایجاد/ویرایش/حذف برای مدیرکل.
- migration افزایشی جدید برای همین collection و unique/indexها تولید و SQL بررسی شود؛ baseline فعلی و applied migrationها حذف یا بازنویسی نشوند. هیچ reset لازم نیست.
- seed کد فعال یا OTP ثابت ایجاد نکند. generated types/import map با generator تولید شوند.

### ۲. commandهای کوچک Payload و مرز تراکنش

- API همچنان customer authentication/JWT و ارسال کاوه‌نگار را نگه دارد؛ CMS مالک ذخیره، cooldown، attempts و مصرف باشد. اتصال REST فعلی حفظ شود؛ API مستقیم به DB وصل نشود.
- سه عملیات محدود server-to-server: `issue`، `verify` و `invalidate`؛ فقط API-key حساب service فعال و مجاز، نه role string تنها. ثبت endpoint باید با نسخهٔ Payload تطبیق یابد. request عمومی حق اجرای Local API یا overrideAccess نگیرد.
- هر عملیات شماره/شناسه و active بودن مشتری را از DB recheck کند. phone و code در trust boundary اعتبارسنجی شوند؛ درخواست malformed هیچ تلاش یا رکوردی نسازد.
- برای جلوگیری از race، در همان تراکنش ابتدا row مشتری قفل شود، سپس رکورد OTP خوانده/نوشته شود. ترتیب ثابت customer→OTP؛ این روش صدور نخستین رکورد و verify/resend را نیز serialize می‌کند. nested operations همان `req` را بگیرند؛ root Drizzle و تراکنش جدا fallback نشوند.
- `issue`: cooldown را بررسی، کد امن تولید، همان رکورد را create/update، attempts=0 و expiry/cooldown جدید ثبت و commit کند؛ سپس کد فقط به API داخلی برای SMS تحویل داده شود.
- `verify`: شرط `now < expiresAt`، code فعال و attempts<5 لازم؛ mismatch شمارنده را اتمیک زیاد کند و در پنجمین خطا code=null شود. نتیجهٔ ناموفق بعد از commit برگردد؛ exception درون transaction نباید افزایش attempts را rollback کند. تطابق ⇒ code=null و commit، سپس موفقیت به API برای صدور JWT. دو verify هم‌زمان فقط یک موفقیت داشته باشند.
- زمان DB مبنا باشد؛ resend کد قبلی را باطل کند. ثابت‌های فعلی TTL/cooldown/attempts در یک محل authoritative باشند.
- `invalidate`: روی شکست قطعی SMS، فقط رکوردی که هنوز همان generation صادرشده است باطل شود؛ از id+created/expiry یا مقدار code برای conditional match استفاده شود تا نتیجهٔ دیررس SMS کد جدید را حذف نکند. cooldown حفظ شود. timeout ارسال موفقیت قطعی محسوب نشود؛ خطا propagate شود، fake success محیط توسعه حفظ نشود. متن/رفتار خطای جدید اگر با UI فعلی متفاوت است پیش از تغییر تأیید جزئی لازم دارد.
- تراکنش هنگام تماس شبکهٔ کاوه‌نگار باز نماند؛ retry خودکار SMS اضافه نشود. قطع پاسخ پس از مصرف ممکن است کاربر را ملزم به درخواست دوباره کند؛ کد مصرف‌شده احیا نشود.

### ۳. جایگزینی Map و پاک‌سازی

- در `apps/api/src/routers/auth.ts` هر دو alias فعلی request/verify به command مشترک متصل شوند؛ قرارداد پاسخ موفق، ارقام فارسی/عربی، TTL و cooldown فعلی محفوظ بمانند. verify async و await شود.
- Map، interval پاک‌سازی و log کد در `apps/api/src/lib/otp.ts:19,87,150` حذف؛ normalization مشترک لازم حفظ شود.
- helper پاک‌سازی به‌صورت bounded و در transaction مستقل/مرز مشخص، قبل از issue/verify با hook/command مشترک اجرا شود: code منقضی null؛ رکوردی که expiry و cooldown هر دو گذشته‌اند حذف شود. پاک‌سازی نباید رکورد فعال یا attempts نسل جدید را حذف کند؛ predicates با زمان DB و row locking هماهنگ باشند.
- خواندن پنل نیز cleanup را از hook مناسب نسخه‌مطابق، بدون recursion و بدون mutation خروجیِ صرف به‌جای DB deletion، trigger کند. helper از Local API دارای همان read hook دوباره استفاده نکند.
- هوک زمان‌بندی نیست: در نبود ترافیک رکورد منقضی ممکن است در DB باقی بماند؛ verify در هر حال آن را رد می‌کند. حذف در لحظهٔ انقضا در این نسخه تضمین نمی‌شود؛ cron/job جدید خارج از دامنه است.

### ۴. آزمون و rollout

- `node:test`/assert و tsx نصب‌شده؛ dependency جدید اضافه نشود.
- واحد: normalization شماره/کد، تولید ۴رقمی، TTL مرزی، cooldown، attempts صفر تا پنج، ACL همهٔ roleها و collectionهای جعلی، نبود code در log/DTO/export.
- PostgreSQL مستقل با اتصال‌های جدا: دو issue هم‌زمان ⇒ یک صدور مجاز؛ verify×verify ⇒ فقط یک مصرف؛ verify×resend، خطاهای موازی بدون lost increment، شکست SMS قدیمی بعد از resend بدون ابطال کد جدید، rollback روی خطای DB.
- پاک‌سازی: منقضی/مصرف‌شده حذف یا null، cooldown زود حذف نشود؛ بدون ترافیک expiry همچنان در verify enforce شود؛ خواندن پنل recursion ایجاد نکند.
- migration از baseline فعلی روی DB مستقل و CRUD معتبر collection؛ تست restart API و دو instance با همان CMS ⇒ OTP پایدار و مشترک.
- پنل: مدیرکل فعال code را می‌بیند ولی نمی‌تواند تغییر دهد؛ manager/support/editor/customer/anonymous و generic machine read denied. password/API-key ادمین غیرفعال نیز مشاهده نکند.
- `pnpm --filter @persianpart/cms generate:types`، `generate:importmap`، `pnpm check-types`، `pnpm build` و تست‌های جدید اجرا؛ lint فقط اگر manifest تعریف کرده باشد.
- rollout هماهنگ CMS migration/command و API async؛ برای یک بازهٔ ۱۲۰ثانیه‌ای maintenance ورود، Mapهای قدیمی تخلیه/فرایندها restart شوند و کاربران کد جدید درخواست کنند؛ dual-write یا fallback حافظه‌ای نسازید. migration روی DB واقعی فقط با مقصد معلوم؛ reset/seed واقعی لازم نیست.

## معیار تحویل

صدور، بررسی، سقف تلاش و مصرف یک‌باره از PostgreSQL مشترک کار کنند؛ OTP در restart گم نشود؛ مدیرکل read-only کد فعال را ببیند؛ پاک‌سازی با محدودیت lazy صریح، migration و تست‌های واقعی ثبت شوند. امنیت سایر بخش‌های سیستم یا اتمام پلن تاریخی در این کار ادعا نشود.

---

# سابقه: پلن اصلاحیهٔ CMS/API/Web — امنیت و تمامیت داده

وضعیت: آمادهٔ اجرای مرحله‌ای با گیت توقف؛ نه مجوز تغییر UI، reset، دسترسی به DB مشترک یا گردش credential واقعی.

## ۱. مبنا و حدود ادعا

- مرجع تصمیم‌های تثبیت‌شده: `.agents/brain/cms-hardening-plan.md`؛ این سند اصلاحیه است، نه جایگزین متفاوت آن. ساختار collectionها، REST، نقش‌های انسانی، PostgreSQL، tier pricing، lifecycle و قفل UI محفوظ‌اند.
- بررسی فعلی خواندنی است؛ build، DB، تست رقابت، browser و استقرار دوباره اجرا نشده‌اند. ادعاهای قبلی «همه رفع شد»، «UI محفوظ» و بسته‌شدن F02/F07/F08/F09/F10/F11/F12 با شواهد فعلی قابل اتکا نیستند.
- Payload نصب‌شده 3.90.2 است. در `payload/dist/collections/operations/updateByID.js:24,61,126` تراکنش پیش از `beforeOperation` آغاز و سند پس از آن خوانده می‌شود. در `create.js:30` نیز تراکنش آغاز می‌شود. این ترتیب باید پیش از پیاده‌سازی دوباره با lockfile تطبیق داده شود.
- سورس conditional UPDATE موجود بهتر از read/write قبلی است؛ اما fallback به root Drizzle و نبود قفل سفارش، معیار atomicity/exact-once را تأمین نمی‌کند.
- وضعیت git شامل تغییرات قبلی و فایل‌های untracked است؛ diff ساده همهٔ کد تازه را نشان نمی‌دهد. هیچ تغییر کاربر حذف، overwrite یا خودکار revert نشود.

## ۲. قیود و نقاط توقف

1. هیچ UI وب یا CMS، شامل متن، navigation، read-only، خطا/موفقیت، cache-dependent display، deadline، status، upload یا تعامل عدد، بدون تأیید جزئی تغییر نکند. امنیت و «رفع باگ» معافیت نیستند.
2. برای هر اثر UI: مسیر/نقش/وضعیت/viewport/RTL، تصویر و سناریوی فعلی، رفتار دقیق قبل/بعد و گزینهٔ بدون تغییر UI ثبت و تأیید مستقل اخذ شود؛ بدون آن فقط بخش مستقل ادامه یابد و rollout وابسته متوقف باشد.
3. پرسش سفارش اختصاصی پاسخ نگرفت؛ سکوت تأیید نیست. تصمیم inquiry مستقل یا سفارش معتبر و مجوز UI آن باز است. ordinary order با `items:[]` مجاز نشود و collection حدسی تازه ساخته نشود.
4. تغییر gateway، موتور تخفیف، OTP/revocation-store redesign و معماری service/repository جدید خارج از دامنه‌اند. ریسک OTP و revocation صریح ثبت شود؛ تغییر دامنه فقط با تأیید مستقل.
5. محیط تست PostgreSQL مستقل با مقصد مشخص لازم است؛ DB واقعی/مشترک، SMS واقعی، seed تولید، reset، `migrate:fresh` و down مخرب ممنوع‌اند. نبود محیط آزمون، dependent release را blocked می‌کند.

## ۳. طراحی مرزهای نهایی

- CMS مالک قیمت، snapshot، inventory، lifecycle و تاریخچه؛ API مالک customer authentication و orchestration؛ وب صرفاً مصرف‌کنندهٔ committed result.
- هویت انسانی و ماشینی جدا؛ ماشین نه superadmin است، نه هویت قابل ورود تعاملی. ترجیح مصوب: collection مجزای service identity با API-key رسمی Payload و مجوز محدود؛ افزودن collection به config/admin حتی اگر مخفی باشد از گیت UI عبور کند.
- command ورودی مشتری فقط product ID، requestedArea، delivery/notes مجاز و intent key دارد؛ actor/owner از فرم مشتری پذیرفته نشود. API پس از احراز هویت آن را در کانال server-to-server معتبر می‌فرستد؛ CMS فقط برای ماشین مجاز این context را می‌پذیرد و customer فعال، مالکیت و deadline را از DB دوباره بررسی می‌کند. ادعای actor از anonymous/staff غیرمجاز یا ورودی JSON عمومی مردود است.
- `inventorySqm` موجودی قابل فروش مرجع؛ `stockCartons=floor(inventorySqm/sqmPerCarton)` مشتق. whole-carton delivery از snapshot بسته‌بندی محاسبه شود.
- هیچ write مالی بدون تراکنش فعال PostgreSQL اجرا نشود. root Drizzle/pool و SQLite fallback ممنوع؛ همهٔ Local APIهای تو در تو همان `req` را بگیرند.

## ۴. فهرست اصلاحات، راهکار و معیار پذیرش

### A — هویت، ACL و محرمانگی (F01/F07/F08/F11)

| ID | شاهد فعلی | راهکار best-practice و معیار پذیرش |
|---|---|---|
| A01 | `apps/cms/src/access/roles.ts:14` هویت بر مبنای `collection OR role` و active اختیاری | تطبیق دقیق collection + role مجاز + `isActive===true`؛ تست foreign collection با role ادمین، role ناشناخته و active غایب/false. |
| A02 | `roles.ts:35`، `collections/users/users.collection.ts:16`، `orders/orders.collection.ts:19`، `plans/plans.collection.ts:17` دسترسی بیش از نقش | ACL جدا برای read/create/lifecycle/notes/delete و field protection؛ support فقط خواندن مشتری/سفارش و یادداشت، manager طبق پلن اصلی، editor کاتالوگ/مدیا. ماشین فقط عملیات لازم API، نه حذف یا ویرایش آزاد catalog/staff. تست matrix همهٔ collection/field/role؛ اثر UI gated. |
| A03 | `collections/admins/admins.collection.ts:21`، `sdk.ts:164`؛ compose فاقد credential API | machine provisioning سروری جدا از seed، credential متعلق به ماشین محدود، منع interactive login و مدیریت staff؛ runtime API وجود credential و هویت مورد انتظار را fail-closed بررسی کند؛ Compose متغیر الزامی پاس دهد، بدون public fallback. prefix SDK با collection واقعی تطبیق یابد. تست credential مفقود/نامعتبر و superadmin key به‌جای ماشین. |
| A04 | `admins.collection.ts:29,41`؛ Payload `registerFirstUser.js:26` با overrideAccess | bootstrap کنترل‌شدهٔ one-time با forced superadmin و serialization DB؛ endpoint عمومی first-user در استقرار بسته، نه اتکا به create ACL. تست دو bootstrap هم‌زمان و بسته‌شدن پس از اولین ادمین؛ UI bootstrap gated. |
| A05 | `admins/_is-active.before-login.ts:3`، `payload.ts:108` | auth/session boundary با account state تازه در JWT/API-key/me/refresh؛ helper نقش واقعی را حفظ کند، نه تبدیل editor/support/service به admin. تست deactivate پس از صدور توکن و کلید. ACL موجود بخشی از inactive access را می‌بندد؛ exploit عمومی آن ادعا نشود. |
| A06 | `collections/products/products.collection.ts:17,168`، `apps/api/src/routers/shopping.ts:15,111`، `router.helpers.ts:64` | کاتالوگ B2B در CMS و تمام aliasهای API خصوصی؛ active filtering و ممنوعیت public `onlyActive:false`. ماشین قیمت پایه را فقط برای کاربرد داخلی لازم بخواند؛ DTO مشتری final price تنها. تست direct CMS، relation population، alias و calculator؛ تغییر دسترسی قابل مشاهده gated. |
| A07 | `apps/api/src/routers/router.helpers.ts:106`، `order.ts:31,58`، `plan.ts:23,42`، `user.ts:48` | DTO allowlist صریح و typed برای product/order/profile/plan/taxonomy؛ nested relations نیز map شوند؛ users سایر گیرندگان، notes، base/markup/pricing basis حذف؛ `z.any()` جایگزین‌های خروجی پس از mapping مصرف‌کننده حذف. تست با canaryهای محرمانه در JSON کامل، نه فقط فیلد top-level؛ shape لازم UI محفوظ. |
| A08 | `payload.config.ts:27,68`، `apps/api/src/lib/jwt.ts:4`، `docker-compose.yml:7,25,53` | runtime validator برای secret مستقل CMS/API، منع placeholderهای شناخته‌شده و URI غیر PostgreSQL؛ حذف SQLite config/dependency؛ config build نباید راه fallback runtime بسازد. secret لاگ نشود؛ اگر استفادهٔ واقعی تأیید شد rotation و invalidation با مجوز عملیات. تست startup subprocess با مقادیر غایب/ضعیف/placeholder/URI نامعتبر. |
| A09 | `apps/api/src/rpc/context.ts:51`، `server.ts:66`، `lib/jwt.ts:48,65` | یک policy authentication برای RPC و `/api/auth/me`، active دقیق، issuer/audience و الگوریتم مجاز؛ رد user حذف‌شده/pending/suspended. تست endpointهای مختلف با توکن قدیمی/issuer غلط. OTP با Math.random و revocation حافظه‌ای به‌عنوان ریسک جدا باز بمانند؛ اصلاح cryptographic OTP یا persistence revocation نیازمند گسترش دامنه است. |

### B — سفارش، رزرو، lifecycle و idempotency (F02–F05/F09)

| ID | شاهد فعلی | راهکار best-practice و معیار پذیرش |
|---|---|---|
| B01 | `orders/_prepare-order.before-validate.ts:42,73,106` | customer/tier/product فعال و packaging معتبر الزام؛ lookup failure خطا، نه markup صفر یا قیمت/ضریب جادویی. ورودی finite/positive و bounds، جمع duplicate با کنترل overflow، متراژ fixed-point و تومان safe integer. تست negative/NaN/Infinity/extreme، tier غایب، صفر packaging و rounding مرزی. |
| B02 | `orders/_validate-transition.before-change.ts:18`، `orders.collection.ts:79` | presence-based حفاظت تمام identity/money/items/key/fingerprint/snapshot؛ مقایسه canonical نه truthy یا JSON خام populated relation. snapshot durable از SKU/name/packaging/unit price/tier basis/area/amount؛ بخش داخلی در DTO نباشد. تست PATCH تک‌تک فیلدها با null/empty/zero و catalog rename/reprice؛ field تازه visible نشود بدون مجوز. |
| B03 | `orders/_apply-reservation.before-change.ts:18,60,72,142` | transaction session اجباری و typed، همهٔ reads/writes با همان req؛ حذف root/non-Postgres fallback. reserve conditional UPDATE بر area authoritative با affected-row check؛ restore هم RETURNING/row-count لازم. تست شکست بعد از قلم اول، بعد از reserve و قبل از commit؛ order/stock/history همگی rollback. |
| B04 | `_apply-reservation.before-change.ts:103`، `_validate-transition.before-change.ts:14` | قفل order پیش از خواندن originalDoc با `beforeOperation` نسخه‌مطابق و `SELECT FOR UPDATE` همان transaction؛ پس از انتظار، state تازه ملاک باشد. قفل دیرهنگام در beforeChange با originalDoc کهنه کافی نیست. همهٔ مسیرهای Admin/REST/Local/bulk همین مرز را رعایت کنند؛ bulk با IDهای مرتب و recheck تازه پشتیبانی یا مسیر ناامن بدون تغییر UI تأییدنشده rollout نشود. تست cancel/cancel و cancel/approve و cancel/completed. |
| B05 | `_validate-transition.before-change.ts:14,41`، `orders.collection.ts:23,181` | create فقط pending؛ transition صریح pending→approve→completed؛ customer فقط pending خود تا ۳۰ دقیقه، staff مجاز pending/approve پیش از completed را لغو کند؛ cancelled terminal، delete/reopen ممنوع. notes از lifecycle جدا؛ تاریخچه سروری actor/time/from/to، نه timeline ارسالی؛ repeated cancel همان نتیجه بدون restore تازه. تست matrix کامل و forged actor/history؛ تغییر کنترل/پیام gated. |
| B06 | `products/products.collection.ts:125,175` | stock/packaging edits با همان product row lock و ترتیب ثابت ID؛ derive cartons از area. برای stock absolute edit، expected version/balance الزامی یا adjustment delta معتبر تا stale admin form رزرو تازه را overwrite نکند. packaging در وجود pending/approve reservation ممنوع؛ snapshot رزرو basis restore. تست reserve/stock-edit، reserve/packaging-edit، همواره cartons مشتق؛ UI فرم/read-only/version conflict gated. |
| B07 | `orders.collection.ts:30`، `_prepare-order.before-validate.ts:15` و نبود key در API | پروتکل idempotency بخش بعد؛ unique ترکیبی customer/operation/key، fingerprint canonical و replay موفق. key immutable و در retry ثابت؛ admin direct create intent مشخص خود را داشته باشد، legacy بدون key مسیر bypass machine نسازد. تست race/replay/conflict/isolation. |
| B08 | `apps/api/src/routers/router.helpers.ts:120`، `order.ts:171` | حذف after-create renumber و catch سازندهٔ شمارهٔ جعلی؛ فقط شمارهٔ committed CMS برگردد. تولید create-only collision-resistant با crypto UUID/شناسهٔ پایدار و unique DB؛ prefix/نمایش شماره با baseline و گیت UI تطبیق یابد. تست response/detail/list/lookup یکسان و PATCH ثابت. |
| B09 | `apps/api/src/routers/order.ts:128`، `shopping.ts:123`، `packages/contract/src/shopping.ts:95` | دو alias از یک command helper کوچک مشترک و schema معتبر استفاده کنند؛ بدون pricing duplication، clamp یا default quantity. خطاهای 400/403/409/stock conflict نگاشت صریح، پاسخ فقط committed. createCustomOrder با items خالی فعلاً blocked برای تصمیم تجاری؛ ordinary validation تضعیف نشود. |

#### پروتکل اجرایی تراکنش و retry

1. برای machine create یک endpoint/command محدود CMS با REST موجود تعریف شود؛ replay در لایهٔ command برگردد، نه hook beforeValidate که فقط data را تغییر می‌دهد.
2. command احراز ماشین و actor معتبر را انجام دهد؛ transaction owner مشخص باشد؛ normalized request شامل customer، operation، اقلام duplicate-merged و sort‌شده، requestedArea در واحد صحیح، delivery/notes مؤثر بر سفارش باشد. قیمت روز در fingerprint ورودی نباشد تا retry پس از تغییر catalog همان سفارش قبلی را برگرداند.
3. `(customerId, operation, key)` با طول/فرمت محدود؛ fingerprint از canonical payload با SHA-256. unique constraint ترکیبی durable حفظ شود؛ global unique فعلی با migration ایمن جایگزین گردد.
4. قفل transaction-scoped advisory بر scope/key برای serialize replay؛ برخورد hash فقط serialization اضافه ایجاد کند، نه اشتباه هویتی. پس از قفل، سفارش قبلی از DB خوانده شود: fingerprint برابر ⇒ همان committed result؛ متفاوت ⇒ 409 بدون تغییر.
5. در create جدید، customer/tier و product snapshots در همان transaction خوانده و تغییرات مؤثر با قفل row یا validation نسخه serialize شوند. محصولات به ترتیب یکسان ID قفل و قیمت/بسته‌بندی از همان rows مبنا شود؛ سپس reserve و order/history/snapshot اتمیک درج شوند.
6. در update: اول order lock و state تازه، سپس product locks به ترتیب ثابت. stock adjustment فقط product locks دارد و نباید بعداً order row را قفل کند؛ packaging guard فقط وضعیت معتبر سفارش‌ها را بررسی کند تا چرخهٔ قفل نسازد.
7. تراکنش owner فقط پس از موفقیت همهٔ writes commit کند؛ خطا rollback و propagate. replay response پس از commit قابل اتکا باشد. unique violation با transaction شکست‌خورده query نشود؛ در صورت fallback race، rollback سپس read جدید برای بررسی replay.
8. قطع پاسخ پس از commit با key قبلی قابل بازیابی؛ خطای پیش از commit هیچ deduction بر جا نگذارد. deadlock/serialization failure فقط در command با key پایدار و retry محدود کل transaction قابل تکرار است؛ write عمومی SDK خودکار retry نشود.
9. مسیر direct collection create/update نیز همان invariants را در hooks enforce کند؛ endpoint اختصاصی نباید تنها محل حفاظت باشد. bypass Local API صرفاً عملیات trusted و محدود، نه پرچم ارسالی مشتری.

### C — مصرف‌کنندهٔ وب و transport

| ID | شاهد فعلی | راهکار best-practice و معیار پذیرش |
|---|---|---|
| C01 | `apps/web/src/features/checkout/pre-invoice-modal.tsx:225,243`، `features/orders/order-store.ts:340` | یک owner برای submit؛ نتیجهٔ سرور وارد store شود، store دوباره submit نکند. intent key قبل از اولین درخواست تولید و برای همان intent تا نتیجهٔ قطعی/اصلاح payload نگه‌داری شود؛ reload retry در صورت پشتیبانی فعلی همان key را حفظ کند؛ intent جدید key جدید. یک کلیک/دابل‌کلیک/timeout فقط یک order/deduction. حذف write دوم بی‌اثر ظاهری قابل اجرای مستقل است فقط با baseline اثبات‌شده. |
| C02 | `pre-invoice-modal.tsx:239`، `order-store.ts:298,407` | موفقیت، clear cart و تغییر state فقط پس از committed server result؛ حذف داده/ID/مشتری جعلی، fake success و swallow submit/cancel errors. local edit/reactivate بدون command معتبر موفق نشان داده نشود. tax/discount صفر CMS و money سروری مرجع. تغییر error/success/edit رفتار UI است و مجوز جزئی می‌خواهد. |
| C03 | `order-store.ts:181,243,257`، `auth/auth-store.ts:104,179` | cache خصوصی scoped به identity و پاک‌سازی روی logout/switch؛ empty response واقعاً cache را خالی کند؛ detail cache پیش از احراز مجدد جایگزین authorization نشود. deadline ۳۰ دقیقه و approve≠completed از داده/قابلیت سرور؛ نمایش/labels/کنترل‌ها gated. تست A→logout→B، پاسخ خالی، reload و خطای شبکه. |
| C04 | `apps/api/src/routers/shopping.ts:159` | verifyPayment اکنون فقط ownership را می‌سنجد؛ caller وب فعلی یافت نشد. بهترین راهکار بدون gateway: endpoint مالی غیرفعال/پاسخ unsupported معتبر، نه verified:true. callerهای بیرونی و contract بررسی شوند؛ تغییر flow/message بدون مجوز اجرا/rollout نشود. unpaid/cancelled هرگز پرداخت تأییدشده نشوند. |
| C05 | `apps/cms/src/sdk.ts:67,79,103,137` | method مؤثر از init یا Request.method، signal مؤثر از هر دو؛ native signal composition با cleanup و تفکیک caller abort از timeout. Request POST هرگز GET محسوب نشود؛ caller cancellation retry نشود؛ GET retry محدود. تست fetch تزریقی با Request/init، 503/network، abort پیشین/میان‌راه و timeout. |

### D — migration، seed، plan، slug و media (F06/F10–F12)

| ID | شاهد فعلی | راهکار best-practice و معیار پذیرش |
|---|---|---|
| D01 | `migrations/20261010_092902_baseline.ts:57,137,181`، `20261027_100000_idempotency_and_hardening.ts:4` | corrective migration کامل، نه فقط idempotency: dimensions/customer-types و FK/lock relations، product dimension، تبدیل tier enum به رابطه، username legacy، admin service/machine schema، order enums/cancelledBy، timeline title/date/actor، nullable product legacy، snapshots/fingerprint/indexها. generated schema diff معیار completeness؛ migration identity/applied history حفظ. |
| D02 | همان corrective migration `:30` | preflight drift/legacy داده و نگاشت deterministic؛ ambiguity در tier/status/history/stock توقف، نه snapshot مالی ساختگی. constraintهای finite/nonnegative و unique مطابق schema؛ invalid legacy با گزارش nonsecret، بدون clamp/reset. down حذف key/credential/history مالی پیش‌فرض نباشد؛ rollback اپ سازگار یا refusal صریح down مخرب. |
| D03 | `apps/cms/src/seed.ts:840,1126,1218` | development-only و exact disposable target guard پیش از نخستین write؛ fixture identity ثابت، create-if-missing و عدم overwrite live state/packaging/customer status/orders. lifecycle معتبر، timestamps ثابت، existing order دوباره update نشود. دوبار اجرای موفق با semantic state یکسان و stock یکسان؛ هدف غیرمجاز بدون write رد شود. |
| D04 | `seed.ts:1261`، `plans/_personalize-plan.after-read.ts:3`، `plans.collection.ts:17` | plan فقط userPhone گیرندهٔ fixture، نه allUserIds؛ حذف unsupported discount/timer/product fields. template canonical برای admin، personalization فقط گیرندهٔ احرازشده و مجاز، نه arbitrary context name. DTO بدون سایر recipients؛ تست دو گیرنده و admin edit بدون mutation template. تغییر متن نمایش gated. |
| D05 | `products/_sync-slug-and-dimensions.before-validate.ts:3` | explicit و existing slug محفوظ؛ sku-only PATCH URL را regenerate نکند. generated slug با Unicode normalization و suffix deterministic از SKU کامل؛ DB unique و collision handling محدود، حتی punctuation-only. URL موجود بازنویسی انبوه نشود. تست SKU فارسی/معادل Unicode/punctuation و concurrent collision. |
| D06 | `apps/api/src/server.ts:83`، `collections/media/media.collection.ts:28` | policy مشترک تمام مسیرهای upload: authorization، سقف ۱۵ MB پیش از buffering، actual decoded image با sharp موجود و limits dimensions/pixels، filename امن و path containment؛ SVG بدون سیاست ایمن پذیرفته نشود. URL/volume فعلی محفوظ؛ no file persisted روی رد شدن. preview/error/upload interaction gated. |
| D07 | `app/(payload)/admin-enhancements.tsx:30,50` | حذف selection API نامعتبر برای type=number و استفاده از event/state مورد پشتیبانی controlled form؛ ابتدا مجوز تعامل. تست browser تایپ/paste ارقام فارسی/عربی، ذخیره و reload مقدار، بدون exception یا تغییر RTL/cursor تأییدنشده. |

## ۵. ترتیب اجرا و گیت‌ها

1. **R0 — baseline و گزارش وضعیت:** revision/lockfile/version، tracked/untracked diff، migration status فقط مقصد مجاز؛ baseline UI از revision قبل از تغییرات اخیر و working tree فعلی با fixture/نقش/viewport ثابت مقایسه شود. نبود baseline = حفظ UI unverified. فهرست F01–F12 و A01–D07 با owner/check/status ساخته شود.
2. **R1 — harness مستقل:** `tsx` نصب‌شده + `node:test`/assert؛ تست regression هر finding ابتدا fail ثبت کند. PostgreSQL disposable با URI دقیق و guard؛ نه DB مشترک و نه SMS. manifest فعلی lint ندارد؛ نصب lint خارج از دامنه.
3. **R2 — schema و migration کامل در isolation:** schema هدف را براساس snapshot/identity/idempotency نهایی کن؛ migration از baseline و metadata فعلی تولید و SQL review؛ تاریخچهٔ applied دست نخورد. شاخهٔ credential و UI-gated fields فقط پس از مجوز قابل rollout است.
4. **R3 — identity و boundaries:** A01–A09 و D06؛ ماشین provision و API credential پیش از lockdown آماده/تست شوند. deploy هماهنگ یا maintenance fail-closed؛ هرگز public fallback برای حفظ API.
5. **R4 — order core:** B01–B09 با transaction protocol؛ R2 schema در DB مستقل حاضر باشد. concurrency/rollback suites پیش از اتصال وب پاس شوند.
6. **R5 — مصرف‌کننده و عملیات:** C01–C05 و D03–D07؛ فقط UI scope تأییدشده. custom-order، fake payment flow و edit/reactivate unresolved مستقل متوقف بمانند؛ به‌عنوان complete علامت نخورند.
7. **R6 — بازبینی مستقل و rollout:** تمام مسیرهای مستقیم CMS، API و aliasها، DTO و browser scenarios دوباره بررسی؛ credential+schema+ACL نسخه‌های سازگار هماهنگ deploy شوند. ترافیک API قدیمی بدون credential یا key protocol پذیرفته نشود.

## ۶. تست‌های لازم برای بستن یافته‌ها

- **ACL/auth:** anonymous، active/inactive staff با JWT/API-key قبلی، customer، machine، foreign collection/role، support notes-only، escalation، bootstrap race، `/me` و refresh، missing/wrong secrets.
- **DTO:** canary محرمانه برای basePrice/markup/notes/pricing basis/recipient دوم؛ نبود آن در JSON کامل همهٔ endpointها با depth و alias مختلف.
- **مالی:** finite/positive/bounds، duplicate overflow، کارتن کسری، tier/customer/product نامعتبر، rounding مرزی، snapshot پس از catalog edit، PATCH همهٔ فیلدهای محافظت‌شده.
- **رقابت واقعی با اتصال مستقل DB:** stock=یک سفارش و دو create هم‌زمان، failure قلم دوم و failure پیش از commit، cancel×cancel، cancel×approve/completed، stock-edit×reserve، packaging-edit×reserve، deadlock recovery. مجموع stock/order/history پس از هر run assert شود؛ تست فقط mock SQL اثبات concurrency نیست.
- **Idempotency:** same scope/key/payload هم‌زمان ⇒ یک order و یک deduction با پاسخ موفق یکسان؛ payload متفاوت ⇒ 409؛ customer/operation متفاوت مستقل؛ key جدید برای intent مستقل؛ response lost پس از commit ⇒ replay همان order.
- **migration:** DB خالی با کل chain و DB ساخته‌شده فقط از baseline قبلی؛ fixture legacy معتبر و ambiguity fixture جدا؛ current CRUD/provision/order/timeline؛ schema diff بدون drift؛ rollback غیرمخرب یا refusal قابل انتظار.
- **عملیات/UI:** seed دو بار، upload auth/type/size/path، slug concurrency، account-switch cache، یک کلیک یک submit، شکست submit/cancel بدون fake success، Persian number save. موارد UI فقط در دامنهٔ تأییدشده با screenshot/interaction diff؛ baseline برای پنهان‌کردن regression overwrite نشود.

دستورهای manifest موجود در مرحلهٔ اجرا:

```bash
pnpm --filter @persianpart/cms generate:types
pnpm --filter @persianpart/cms generate:importmap
pnpm check-types
pnpm build
```

test script پایدار با runner موجود تعریف و دستور دقیق آن در manifest ثبت شود؛ مثال هدف پس از ایجاد فایل تست: `pnpm --filter @persianpart/cms exec tsx --test src/collections/orders/_orders.integration.test.ts`. تست DB فقط با guard URI مستقل اجرا گردد. generator و build اکنون در Plan Mode اجرا نشده‌اند.

## ۷. تحویل و پذیرش نهایی

- هیچ finding صرفاً با build/typecheck «fixed» نشود. هر A/B/C/D و F01–F12 شامل شاهد فعلی، regression test، خروجی recheck مستقل و یکی از `fixed / blocked / unverified / rejected` باشد.
- artifact تحویل: diff محدود و بدون تغییرات ناخواستهٔ generated/build cache، schema/migration report، ACL matrix، concurrency/rollback evidence، DTO assertions، seed repeatability، UI approval register و baseline diff.
- ریسک OTP/revocation redesign، سفارش اختصاصی مبهم و هر UI gate بدون مجوز صریح باز اعلام شوند؛ در صورت اثر بر ایمنی جریان وابسته rollout آن جریان ممنوع است.
- هیچ commit، reset، seed تولید، credential rotation یا down مخرب بدون مجوز مستقل انجام نشود. تکمیل سراسری فقط وقتی همهٔ blockerهای وابسته بسته شده‌اند قابل ادعا است.

## ۸. گزارش اجرای محدود — ۲۰۲۶/۱۰/۲۷

- اجرا جزئی است؛ تأیید UI دریافت نشد. هیچ ادعای تکمیل سراسری، حفظ UI با browser، امنیت کامل یا آمادگی production وجود ندارد.
- C05: fixed در محدودهٔ transport؛ ۴۱ تست mocked SDK. Request.method/signal، caller cancellation، timeout، retry و cleanup پوشش داده شدند؛ live REST interoperability هنوز unverified.
- B03/B04: حفاظت transaction/session، حذف fallback، propagation req، row lock پیش از خواندن سفارش و stale-state guard، validation رزرو و affected-row restore پیاده شد. ۹ تست واحد و ۷ تست PostgreSQL واقعی پاس؛ harness رقابت سبک است و به‌تنهایی full Payload/REST/bulk history atomicity را اثبات نمی‌کند. packaging/stock-edit races و سیاست lifecycle کامل همچنان بازند.
- D01/D02: migration جدید `20261027_120000_current_schema_completeness.ts` با حفظ دو migration قبلی ثبت شد؛ fresh chain، upgrade با mapping معتبر، توقف ambiguity، metadata نصب‌شده و CRUD/create/approve در DB مستقل آزموده شد. هیچ migration روی DB اپ اجرا نشد. schema آیندهٔ machine/snapshot/fingerprint و rollback مخرب migration قبلی همچنان وابسته به مراحل باز هستند.
- D03: فقط guard توسعه و مقصد disposable محلی با تأیید URI و منع query override افزوده شد؛ repeatability کامل seed، اصلاح گیرندگان plan و fixtureها هنوز blocked/unverified.
- یک نقص runtime دیگر در preparation اصلاح شد: product ID خروجی به‌جای string اکنون عدد معتبر است؛ Local API create در تست migration پس از اصلاح موفق شد. lookupهای order/product و dimension همان req را می‌گیرند.
- شواهد نهایی: `pnpm --filter @persianpart/cms test:hardening` ⇒ ۶۰ passed؛ `CMS_TEST_DATABASE_URI=<isolated-loopback-uri>/cms_hardening_test pnpm --filter @persianpart/cms test:hardening:postgres` ⇒ ۷ passed؛ migration suite با `CMS_MIGRATION_TEST_DATABASE_URI=<isolated-loopback-uri>/postgres` و دستور `test:hardening:migrations` ⇒ fresh/upgrade/CRUD regression passed؛ `pnpm check-types` و `pnpm build` هر سه workspace موفق. lint تنظیم نشده؛ warning اندازه bundle وب باقی است.
- محیط آزمون PostgreSQL 14.20 در کلاستر موقت جدا با پورت 55483 بود؛ Docker daemon در دسترس نبود. DBهای migration موقت حذف و سرویس موقت پس از تست متوقف شد؛ DB واقعی و SMS استفاده نشدند.
- باقی‌مانده/blocked: A01–A09، B01/B02/B05–B09، C01–C04، D04–D07 و تکمیل D03؛ scoped idempotency، ماشین مستقل، ACL/DTO، immutable snapshots، secrets fail-closed، UI واقعی و تصمیم سفارش اختصاصی تکمیل نشده‌اند. اصلاح این بخش‌ها بدون بسته‌شدن گیت‌های مربوط قابل rollout نیست.
- دستورهای پایدار تست در `apps/cms/package.json` ثبت شدند؛ هیچ commit/reset/credential rotation انجام نشد.
