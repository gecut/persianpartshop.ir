# گزارش اجرای قابلیت‌های PWA و تجربهٔ نزدیک به نیتیو — ۲۰۲۶/۱۱/۰۷

## ۱. وضعیت گزارش و حدود اعتبار

- تاریخ ثبت: ۲۰۲۶/۱۱/۰۷، منطقهٔ زمانی Asia/Tehran.
- موضوع: اجرای پلن تأییدشدهٔ ۱۱ قابلیت کم‌ریسک برای PWA پرشین‌پارت.
- وضعیت: پیاده‌سازی در working tree، build و بررسی‌های محلی انجام شده‌اند؛ انتشار production انجام نشده است.
- شاخه هنگام ثبت گزارش: `main`؛ HEAD برابر `9d360975e0af310abd28c8adc35c30a71712046d` است. این hash صرفاً مرجع پایهٔ checkout است و **commit تحویل PWA نیست**؛ تغییرات این تسک هنوز در working tree هستند.
- این فایل گزارش تاریخی تصمیم و اجرا است. شرح جاری قابلیت‌ها و راهنمای تکرار بررسی‌ها در [docs/08-pwa.md](../../docs/08-pwa.md) قرار دارد؛ [docs/README.md](../../docs/README.md) نیز به آن ارجاع می‌دهد.
- در این نوبتِ نوشتن گزارش، سورس و نام آزمون‌ها دوباره خوانده شدند و نسخهٔ وابستگی‌ها از نصب محلی بررسی شد؛ آزمون‌های runtime مجدداً اجرا نشدند. نتایج اجرا در بخش ۸ متعلق به مرحلهٔ پیاده‌سازی همین گفت‌وگو هستند.

## ۲. مسئله، انتخاب دامنه و تصمیم‌های نهایی

در بررسی اولیه، پروژه از قبل skeleton، نوار پایین، bottom sheet، safe area، فهرست مجازی و ذخیرهٔ سبد مقید به حساب داشت. مسئلهٔ این تسک اضافه‌کردن دوبارهٔ این اجزا نبود؛ تکمیل چرخهٔ نصب و بروزرسانی، رفتار قابل‌فهم در اختلال شبکه، پیوستگی ناوبری و حفاظت از کار نیمه‌تمام کاربر بود.

پس از تحقیق، ایده‌پردازی و ارزیابی مستقل پیشنهادها با `nexload-cto-review`، دامنهٔ کم‌ریسک انتخاب شد. کاربر سپس پلن اجرایی را تأیید و اجرای آن را درخواست کرد. پرسش‌های محصولی با پاسخ‌های زیر بسته شدند:

| موضوع | تصمیم تأییدشده |
| --- | --- |
| دعوت نصب | پس از اولین ورود موفق، غیرمسدودکننده؛ پس از پیشنهاد اولیه، دعوت خودکار برای همان مرورگر تکرار نشود. |
| دسترسی دستی | نصب و بروزرسانی همیشه از بخش حساب قابل‌دسترسی باشند. |
| رابط نصب | کامپوننت اختصاصی پروژه با HeroUI؛ پکیج `@khmyznikov/pwa-install` استفاده نشود. |
| رابطهٔ نصب و آپدیت | پنجرهٔ ظاهری مشترک، با جریان و وضعیت مستقل برای هرکدام. |
| اعلام نسخهٔ جدید | بنر غیرمسدودکننده و اقدام اختیاری کاربر؛ بستن بنر تا شروع بعدی اپ معتبر باشد. |
| خروج صریح | اقلام، تعدادها، انبار، توضیحات سبد و پیش‌نویس فرم حساب جاری حذف شوند. |
| انقضای نشست | پیش‌نویس همان حساب حفظ شود؛ خروج اجباری با حذف صریح کاربر یکسان نباشد. |
| عملیات فعال | خروج صریح و اعمال بروزرسانی تا پایان یا خطای درخواست نوشتنی غیرفعال باشند. |
| سفارش با پاسخ نامعلوم | پیش از خروج، احتمال ثبت سفارش و حذف پیش‌نویس توضیح داده شود؛ بازیابی خودکار نتیجه وارد این اجرا نشود. |
| آفلاین | پوستهٔ اپ، اطلاعات موجود در حافظه و راهنمای اتصال؛ بدون کش پایدار API. |
| اشتراک | فقط محصول؛ پس از ورود، همان پنجرهٔ جزئیات موجود باز شود. |

### قابلیت‌های عمداً خارج از این اجرا

- Web Push، مرکز اعلان و جریان‌های پیگیری موجودی/سبد.
- آپلود پیشرفته، Tus، Uppy و ادامهٔ آپلود از بایت قطع‌شده.
- Dexie، `dexie-react-hooks` و persistence کش TanStack Query.
- انتقال سراسری storeها، replication یا دیتابیس محلی محصولات و سفارش‌ها.
- دفتر عملیات پایدار، endpoint استعلام idempotency و replay خودکار سفارش.
- ساخت و اعتبارسنجی کامل سبد آفلاین یا ثبت سفارش موفقِ صرفاً محلی.
- اشتراک سفارش/طرح، ساخت PDF و صفحهٔ مستقل تازه برای محصول.
- تغییر رفتار Back برای تمام modalها، انیمیشن سراسری مسیرها و prefetch گسترده.
- پیاده‌سازی یا بازطراحی قابلیت QR؛ تغییرات موجود آن حفظ شدند.

## ۳. ماتریس تحویل ۱۱ قابلیت

| قابلیت منتخب | نتیجهٔ پیاده‌سازی | شاهد اصلی |
| --- | --- | --- |
| تفکیک خطای شبکه از نشست نامعتبر | خطاهای موقت نشست موجب logout عمومی نمی‌شوند؛ نشست واقعاً نامعتبر و وضعیت مسدودی همچنان دسترسی را متوقف می‌کنند. خطای lookup حساب در CMS نیز از guest جدا شد. | [ریشهٔ وب](../../apps/web/src/routes/__root.tsx)، [تشخیص خطای نشست](../../apps/web/src/lib/session-error.ts)، [context API](../../apps/api/src/rpc/context.ts) |
| حالت خطا، نتیجهٔ خالی و تلاش مجدد | `DataStatus` در صفحات داده‌محور اضافه شد؛ شکست اولیه از فهرست واقعاً خالی تفکیک می‌شود و خطای تازه‌سازی دادهٔ موجود را حذف نمی‌کند. | [DataStatus](../../apps/web/src/components/feedback/data-status.tsx)، مسیرهای محصول، سفارش، طرح و حساب |
| صداقت ذخیره‌سازی | ذخیرهٔ پروفایل await می‌شود؛ خطای API دیگر نادیده گرفته نمی‌شود. خطای نوشتن پیش‌نویس، هشدار ذخیره‌نشدن دارد. | [auth-store](../../apps/web/src/features/auth/auth-store.ts)، [ProfileView](../../apps/web/src/features/account/profile-view.tsx)، [drafts](../../apps/web/src/lib/drafts.ts) |
| هماهنگی حساب میان تب‌ها | خروج و تغییر هویت در تب‌های دیگر منعکس می‌شوند؛ پاسخ دیررس با توکن پیشین پذیرفته نمی‌شود؛ حافظهٔ خصوصی طرح‌ها و cache نشست قبلی پاک می‌شوند. | [auth-store](../../apps/web/src/features/auth/auth-store.ts)، [کلاینت وب](../../apps/web/src/lib/api-client.ts)، [plans-store](../../apps/web/src/features/plans/plans-store.ts) |
| نصب استاندارد و رابط اختصاصی | manifest، آیکون‌های نصب و راهنمای پلتفرم اضافه شدند؛ دعوت بعد از ورود و دسترسی حساب وجود دارد. | [پیکربندی Vite](../../apps/web/vite.config.ts)، [PwaControls](../../apps/web/src/features/pwa/pwa-controls.tsx) |
| بروزرسانی اختیاری | worker منتظر با بنر اعلام می‌شود؛ reload با اقدام کاربر، پس از flush پیش‌نویس و نبود نوشتن فعال انجام می‌شود. | [PwaControls](../../apps/web/src/features/pwa/pwa-controls.tsx)، [write-activity](../../apps/web/src/lib/write-activity.ts) |
| پوستهٔ آفلاین و کش محدود asset | اجرای پوسته پس از دریافت موفق ممکن است؛ API کش نمی‌شود؛ بنر قطع ارتباط و مسیر اتصال مجدد وجود دارند. | [Workbox config](../../apps/web/vite.config.ts)، [PwaControls](../../apps/web/src/features/pwa/pwa-controls.tsx) |
| تازه‌سازی دستی و هدفمند | queryهای active و stale از رفتار focus/reconnect استفاده می‌کنند؛ کنترل دستی در صفحات داده‌محور و جزئیات سفارش اضافه شد. polling عمومی جدید اضافه نشد. | [QueryClient](../../apps/web/src/lib/query-client.ts)، [جزئیات سفارش](../../apps/web/src/routes/orders/$id.tsx) |
| بازیابی موقعیت فهرست | scroll restoration در Router فعال است؛ عمق فهرست و تب سفارش‌ها در sessionStorage مقید به حساب نگه داشته می‌شوند؛ تغییر فیلتر، عمق را بازنشانی می‌کند. | [ورودی وب](../../apps/web/src/main.tsx)، [use-session-value](../../apps/web/src/hooks/use-session-value.ts)، مسیرهای فهرست |
| حفظ متن پیش‌نویس | توضیحات سبد و فرم نام/فروشگاه/آدرس ذخیره می‌شوند؛ refresh آن‌ها را بازیابی و لغو صریح ویرایش، ثبت موفق یا خروج صریح آن‌ها را حذف می‌کند. | [drafts](../../apps/web/src/lib/drafts.ts)، [سبد](../../apps/web/src/routes/cart.tsx)، [ProfileView](../../apps/web/src/features/account/profile-view.tsx) |
| اشتراک لینک محصول | لینک کمینهٔ محصول، دریافت جزئیات خارج از مجموعهٔ اولیه، حفظ مقصد پس از ورود و fallback اشتراک پیاده شدند. | [ProductShare](../../apps/web/src/features/products/product-share.tsx)، [مسیر محصول](../../apps/web/src/routes/product/index.tsx)، [ورود](../../apps/web/src/features/auth/login-card.tsx) |

این ماتریس تحویل سورس را نشان می‌دهد؛ پوشش مشاهده‌شده و محدودیت هر ادعای runtime در بخش‌های ۸ و ۹ آمده‌اند.

## ۴. جزئیات معماری و رفتار

### ۴.۱. نشست، خطا و درخواست‌ها

- `isSessionError` کدهای ساخت‌یافتهٔ `UNAUTHORIZED`، HTTP 401 و دادهٔ `USER_BANNED` را تشخیص می‌دهد؛ ممنوعیت تجاری یک محصول یا دسته به‌طور عمومی معادل خروج نیست.
- بررسی چهارثانیه‌ای نشست موجود حفظ شد؛ polling فراگیر جدید اضافه نشد. خطای موقت آن به کاربر با امکان تلاش مجدد نشان داده می‌شود.
- کلاینت مشترک API یک ورودی اختیاری `fetch` دریافت کرد. کلاینت وب از این seam برای timeout، ردیابی نوشتن و رد پاسخ متعلق به توکن قدیمی استفاده می‌کند؛ API wire shape تغییر نکرد.
- زمان انتظار در wrapper وب ۳۰ ثانیه است. پاسخ clone شده پیش از اتمام بررسی می‌شود تا خواندن body نیز در محدودهٔ انتظار باشد. timeout یا abort، اثبات لغو تراکنش سرور نیست.
- mutationهای Query با `networkMode: 'always'` و `retry: false` تنظیم شدند؛ عملیات نوشتنی به صف آفلاین نامحدود تبدیل نمی‌شود. retry ثبت سفارش همچنان انتخاب صریح کاربر و با هویت idempotency موجود است.
- قفل خروج/آپدیت هم فعالیت transport و هم mutation را می‌بیند؛ دریافت header پاسخ به‌تنهایی به معنی پایان پردازش رابط نیست.
- برای سفارش با شکست ارتباط، یک نشان هشدار مقید به حساب نگه داشته می‌شود. این نشان، دفتر عملیات یا نتیجهٔ قطعی سفارش نیست؛ متن هشدار پیش از خروج را پشتیبانی می‌کند.

### ۴.۲. اصلاح لازم در مرز API

در سورس اولیه، شکست lookup کاربر در CMS می‌توانست به context مهمان و سپس `{ user: null }` تبدیل شود. در نتیجه، اصلاح شرط logout در React به‌تنهایی مشکل اختلال سرویس را حل نمی‌کرد.

- `Context.authUnavailable` برای تمایز اختلال lookup از حساب حذف‌شده اضافه شد.
- middleware مشترک، این وضعیت را به `SERVICE_UNAVAILABLE` تبدیل می‌کند؛ حسابی که واقعاً یافت نمی‌شود، مسیر unauthenticated خود را حفظ می‌کند.
- handler نشست نیز خطای موقت lookup ثانویه را به `{ user: null }` تبدیل نمی‌کند.
- در آزمون تجربی مشخص شد throw مستقیم هنگام ساخت context لزوماً به پاسخ سریال‌شدهٔ موردانتظار در adapter تبدیل نمی‌شود؛ طرح نهایی، خطا را داخل middleware بعد از ساخته‌شدن context مطرح می‌کند.
- آزمون با `RPCHandler` واقعی و SDK شبیه‌سازی‌شده، HTTP 503 را بررسی کرد. این آزمون، socket زندهٔ Hono/CMS را آزمایش نمی‌کند.
- endpoint، مدل CMS یا migration جدیدی برای PWA اضافه نشد؛ تغییر عمومی کلاینت به ورودی اختیاری fetch و تغییر داخلی context به پرچم خطای lookup محدود است.

### ۴.۳. مالکیت و دوام دادهٔ محلی

| محل/کلید | مسئولیت |
| --- | --- |
| حافظهٔ TanStack Query | دادهٔ سرور در نشست جاری؛ بدون persistence API |
| `persianpart_draft_v3:<account>` | مالک موجود اقلام، مقدار و انبار پیش‌نویس سبد |
| `persianpart_draft_v3:<account>:submission` | هویت تلاش مجدد موجود سفارش |
| `persianpart_text_v1:<account>:cart-notes` | توضیحات متنی سبد |
| `persianpart_text_v1:<account>:profile` | پیش‌نویس متنی نام، عنوان فروشگاه و آدرس |
| `persianpart_text_v1:<account>:order-uncertain` | نشان هشدار نتیجهٔ نامعلوم؛ نه نتیجهٔ سفارش |
| `persianpart_view:<account>:...` در sessionStorage | عمق فهرست و تب انتخاب‌شده |
| `persianpart_install_offered` | سابقهٔ دعوت نصب در همان مرورگر، مستقل از خروج حساب |
| `persianpart_explicit_logout` | اطلاع خروج صریح برای جلوگیری از ذخیرهٔ دوبارهٔ draft در تب دیگر |
| `persianpart_writing:<tab-id>` | heartbeat فعالیت نوشتنی؛ بدون محتوای سفارش یا فرم |

- ذخیرهٔ متن پس از ۳۰۰ میلی‌ثانیه انجام می‌شود؛ blur، مخفی‌شدن صفحه، pagehide و اقدام آپدیت نیز flush دارند.
- خطای ذخیره، دادهٔ حافظه را نگه می‌دارد و هشدار می‌دهد. flush ناموفق مانع اعمال آپدیت می‌شود.
- خروج صریح، draft جاری و کلیدهای متنی حساب را پاک می‌کند؛ رویداد discard مانع بازنویسی آن‌ها توسط cleanup کامپوننت یا تب دیگر می‌شود.
- در انقضای نشست، متن همان حساب برای ورود مجدد حفظ می‌شود.
- استفاده از localStorage جدید جایگزین سراسری storeهای فعلی نیست؛ Dexie نصب نشده است.
- کش قدیمیِ مشترک طرح‌ها دیگر بازیابی نمی‌شود و حافظهٔ آن با تغییر حساب پاک می‌شود.

### ۴.۴. هماهنگی فعالیت بین تب‌ها

- تغییرات فعالیت از BroadcastChannel و رویداد storage اطلاع‌رسانی می‌شوند؛ نبود BroadcastChannel با storage-event پوشش داده می‌شود.
- heartbeat هر پنج ثانیه تازه می‌شود و رکورد همتای بدون heartbeat بعد از ۳۵ ثانیه در شمارش معتبر نیست.
- شمارش برای یک شرط boolean «آیا نوشتن فعال داریم؟» استفاده می‌شود؛ با توجه به مشاهدهٔ هم‌زمان transport و mutation، عدد آن معیار تعداد درخواست‌های منحصربه‌فرد نیست.
- در نبود storage، حفاظت محلی همان تب باقی می‌ماند؛ تضمین هماهنگی کامل تب‌ها در این وضعیت ادعا نمی‌شود.

## ۵. نصب، بروزرسانی، کش و استقرار

### تصمیم ابزار

با کناررفتن Push و وظایف سفارشی worker، از پیشنهاد اولیهٔ `injectManifest` به `generateSW` با `registerType: 'prompt'` رسیدیم. در دامنهٔ نهایی، worker دستی منفعت تأییدشده‌ای نداشت. UI نصب/آپدیت خود پروژه است؛ `pwa-install` نصب نشده است.

وابستگی‌های توسعهٔ نصب‌شده و بررسی‌شده هنگام گزارش:

| پکیج | نسخهٔ نصب‌شده |
| --- | --- |
| `vite-plugin-pwa` | `2.0.0` |
| `workbox-build` | `7.4.1` |
| `workbox-window` | `7.4.1` |
| `@playwright/test` | `1.65.0` |

فونت از بستهٔ موجود `@fontsource-variable/vazirmatn` مصرف می‌شود؛ stylesheet و preconnect خارجی Google از HTML حذف شدند. وابستگی‌های QR موجود، بخشی از تحویل این تسک محسوب نمی‌شوند.

### هویت و چرخهٔ اپ

- نام و نام کوتاه: «پرشین‌پارت»؛ زبان `fa` و جهت `rtl`.
- `id` و `scope` برابر `/`، مسیر شروع `/product` و نمایش `standalone`.
- آیکون‌های PNG در اندازه‌های ۱۹۲ و ۵۱۲، maskable با حاشیهٔ امن و apple-touch-icon از نشان موجود ساخته شدند.
- تشخیص اجرای نصب‌شده از display-mode و standalone اپل انجام می‌شود؛ دریافت appinstalled نیز رابط را به‌روز می‌کند.
- پیشنهاد نصب به اقدام کاربر برای prompt بومی وابسته است؛ در نبود آن، راهنمای مرورگر نمایش داده می‌شود.
- onNeedRefresh، بنر نسخهٔ جدید را فعال می‌کند. بستن بنر در state همان بار اجرا نگه داشته می‌شود؛ Account همچنان مسیر دسترسی دارد.
- کنترل update ابتدا نبود نوشتن فعال و موفقیت flush را بررسی می‌کند، سپس worker منتظر را فعال می‌کند. خطای اقدام نصب/آپدیت به کاربر اعلام می‌شود.

### کش

- precache شامل HTML، JS/CSS build، فونت‌های محلی و آیکون‌های نصب است.
- الگوهای QR و wasm از precache کنار گذاشته شده‌اند؛ فایل‌های media داخل مسیر API نیز وارد precache نمی‌شوند.
- سقف اندازهٔ هر فایل precache چهار MiB است.
- کش تصاویر `catalog-images-v1` از `StaleWhileRevalidate`، حداکثر ۱۰۰ ورودی و عمر هفت روز استفاده می‌کند؛ برای تصاویر مسیر عمومی `/assets/images/` همان origin و origin پیکربندی‌شدهٔ CDN است.
- پاسخ API، مدارک مشتری و دادهٔ سفارش در Workbox کش نمی‌شوند.
- fallback ناوبری محدود به مسیرهای اپ است؛ درخواست API یا فایل دارای پسوند به HTML جایگزین نمی‌شود.
- آفلاین‌بودن بعد از شروع تازه، دسترسی به تاریخچهٔ دائمی کاتالوگ یا سفارش ایجاد نمی‌کند؛ صرفاً پوسته و راهنمای اتصال در دسترس‌اند.

### سرو فایل production

[nginx.conf](../../apps/web/nginx.conf) اضافه و از [Dockerfile وب](../../apps/web/Dockerfile) کپی می‌شود:

- HTML، manifest و worker: `Cache-Control: no-cache`.
- worker: مجوز scope ریشه با `Service-Worker-Allowed: /`.
- assetهای build: کش یک‌ساله و immutable؛ تصاویر نام‌ثابت `/assets/images/` استثنا و دارای max-age یک روز هستند.
- فایل ناموجود و مسیر `/api/`: پاسخ 404، بدون fallback به HTML.
- route اپ: fallback به index.html؛ root سرو فایل `/data` و پورت ۸۰ حفظ شده است.

این‌ها تغییرات پیکربندی هستند، نه شاهد اجرای کانتینر. HTTPS، تنظیم reverse proxy و حفظ headerها در مقصد production هنوز باید در همان محیط بررسی شوند. حذف فایل sw.js به‌تنهایی worker نصب‌شده را از دستگاه کاربران حذف نمی‌کند؛ خروج از PWA نیازمند مسیر cleanup worker است.

## ۶. لینک محصول، ناوبری و حفظ کاربر در جریان

- آدرس عمومی رابط: `/product?productId=<positive-numeric-id>`.
- مقدار query با رفتار parse عددی TanStack Router سازگار شده است؛ اشتراک از URL کمینهٔ origin و شناسه استفاده می‌کند.
- جزئیات محصول از API موجود دریافت و با mapper مشترک کاتالوگ به همان bottom sheet متصل می‌شوند؛ وابستگی به حضور محصول در ۵۰۰ قلم اولیه وجود ندارد.
- دسترسی همان حساب بررسی می‌شود. این قابلیت، محدودیت‌های شناخته‌شدهٔ public-read کاتالوگ در معماری موجود را به‌تنهایی تغییر نداده و مجوز سروری جدیدی ایجاد نمی‌کند.
- بستن sheet لینک‌شده، پارامتر محصول را حذف می‌کند و فیلترهای دیگر باقی می‌مانند.
- redirect ورود و ناوبری پس از OTP اصلاح شدند تا مقصد محصول با انتقال پیش‌فرض یا تأخیر قبلی از دست نرود. مقصد به همان origin محدود است.
- Web Share با اقدام کاربر اجرا می‌شود؛ نبود پشتیبانی یا شکست آن به clipboard و سپس input قابل‌انتخاب می‌رسد. لغو عمدی Share خطا اعلام نمی‌شود.
- URL اشتراک شامل توکن، قیمت، فیلترهای جاری یا اطلاعات حساب نیست.
- Router مالک بازیابی اسکرول است؛ nuqs مالک فیلترهای فعلی محصولات باقی مانده است. شمار اقلام نمایان و تب سفارش‌ها در sessionStorage حفظ می‌شوند؛ این کار، ذخیرهٔ سراسری همهٔ stateهای اپ نیست.

## ۷. نقشهٔ فایل‌های تحویل و تغییرات هم‌زمان

### فایل‌های جدید این تسک

- `apps/web/src/features/pwa/pwa-controls.tsx`
- `apps/web/src/components/feedback/data-status.tsx`
- `apps/web/src/features/products/product-share.tsx`
- `apps/web/src/hooks/use-session-value.ts`
- `apps/web/src/lib/drafts.ts`
- `apps/web/src/lib/session-error.ts`
- `apps/web/src/lib/write-activity.ts`
- `apps/web/src/pwa-env.d.ts`
- `apps/web/public/pwa-192.png`، `pwa-512.png`، `pwa-maskable.png`، `apple-touch-icon.png`
- `apps/web/nginx.conf`، `apps/web/playwright.config.ts` و `apps/web/.gitignore`
- `apps/web/e2e/pwa.spec.ts`، `pwa-update.spec.ts` و `pwa-warehouse.spec.ts`
- `apps/api/src/rpc/session-context.test.ts`
- `docs/08-pwa.md` و همین گزارش تاریخی

### فایل‌های موجود که برای PWA تغییر کردند

- API: `src/client.ts`، `src/rpc/context.ts`، `src/rpc/base.ts` و `src/routers/auth.ts`.
- زیرساخت وب: `package.json`، `vite.config.ts`، `index.html`، `Dockerfile`، `src/main.tsx`، `src/lib/api-client.ts` و `src/lib/query-client.ts`.
- جریان‌های وب: auth-store، login-card، profile-view، order-store، plans-store، selection-store، product-store، product-bottom-sheet و مسیرهای root، cart، orders، order detail، plans و product index.
- سند نمایه: `docs/README.md`؛ وابستگی‌ها: `pnpm-lock.yaml`.

### مرز انتساب تغییرات

هنگام شروع اجرا، working tree تمیز نبود. قابلیت QR و تغییرات کاتالوگ/CMS/قراردادها، بعضی اسناد دامنه و فایل‌های fixture از قبل در حال تغییر بودند. در چند فایل وب مشترک، تغییرات PWA روی همان وضعیت موجود اضافه شدند؛ بنابراین کل diff نسبت به HEAD، آمار خط یا کل lockfile را نباید به PWA نسبت داد.

از جمله فایل‌های پیش‌موجود/هم‌زمان خارج از مالکیت این تسک: routerهای catalog/plan و router.helpers، collectionهای products/users، migration و payload-types مربوط به QR، قراردادهای catalog/customer، فایل‌های product-qr و qr-frame، و تغییرات پیش‌موجود cart-store و product/new. این گزارش مدعی ایجاد، تأیید جامع یا commit این مجموعه نیست. سناریوهای موجود انبار و تست‌های API مجاور برای بررسی عدم رگرسیون اجرا شدند.

`routeTree.gen.ts` دستی ویرایش نشد؛ در بررسی نهایی diff مستقلی برای آن وجود نداشت. هیچ commit، push، migration دیتابیس کاری، تغییر credential یا انتشار production در این تسک انجام نشد.

## ۸. شواهد اجرا و پوشش آزمون

### نتایج نهایی و تازگی شواهد

| بررسی اجراشده | نتیجهٔ مشاهده‌شده | حدود اثبات |
| --- | --- | --- |
| `pnpm --filter @persianpart/web build` | موفق؛ شامل `tsc --noEmit` و build تولیدی Vite/Workbox | موفقیت build، نه نصب روی دستگاه |
| `pnpm --filter @persianpart/api exec tsc --noEmit` | موفق | سازگاری TypeScript کد API و ورودی اختیاری fetch |
| `PWA_BROWSER_CHANNEL=chrome pnpm --filter @persianpart/web test:pwa` | ۱۸ تست موفق، بدون شکست؛ حدود ۳۳٫۶ ثانیه برای اجرای مرورگر در آخرین اجرای کامل | Chrome محلی، business API شبیه‌سازی‌شده؛ شامل worker واقعی |
| `pnpm --filter @persianpart/api test` | ۱۸ موفق، ۴ skip، صفر شکست، ۵۷ assertion؛ ۲۲ تست در پنج فایل | واحدهای API و adapter؛ چهار تست live اجرا نشدند |
| `pnpm --filter @persianpart/api exec bun test src/rpc/session-context.test.ts` | شش تست موفق در نسخهٔ نهایی آزمون | lookup واقعی CMS و socket زنده اثبات نمی‌شوند |
| `git diff --check` | موفق | سلامت whitespace؛ نه صحت runtime |
| بررسی viewport در تست مرورگر | عدم overflow افقی در عرض ۳۹۰ و ۱۲۸۰؛ screenshot موبایل دیده شد | بررسی محدود رابط نصب؛ نه audit جامع همهٔ صفحات |

**تفکیک آخرین اجرای کامل از آخرین اصلاحات:** پس از عبور مجموعهٔ کامل ۱۸ تست، تازه‌سازی دستی جزئیات سفارش، پیام خطای اقدام نصب/آپدیت و استثنای کش تصاویر نام‌ثابت در nginx تکمیل شدند. سپس build وب، typecheck API و diff check دوباره موفق بودند و دو سناریوی مرتبط زیر روی وضعیت نهایی دوباره اجرا شدند:

```text
PWA_BROWSER_CHANNEL=chrome pnpm --filter @persianpart/web exec playwright test e2e/pwa-update.spec.ts e2e/pwa-warehouse.spec.ts
2 passed (23.6s)
```

این دو تست تکراری‌اند و به معنای «۲۰ تست منحصربه‌فرد مرورگر» نیستند. اجرای مجدد کل ۱۸ تست پس از آخرین اصلاحات ادعا نمی‌شود.

### فهرست ۱۸ سناریوی مرورگر

۱. خطای موقت نشست: حفظ authentication و نمایش retry.
۲. خطای دریافت کاتالوگ: نمایش خطا به‌جای نتیجهٔ خالی.
۳. ماندگاری متن سبد در refresh و حذف draft حساب با خروج صریح.
۴. انتشار خروج به تب دیگر.
۵. لینک مستقیم محصول خارج از مجموعهٔ اولیه، fallback لینک قابل‌انتخاب و حفظ فیلتر پس از بستن sheet.
۶. راهنمای نصب از حساب و نبود overflow در موبایل/دسکتاپ.
۷. خطای storage و هشدار پیش‌نویس ذخیره‌نشده.
۸. شکست ذخیرهٔ پروفایل: حفظ ویرایشگر و نبود پیام موفقیت کاذب.
۹. غیرفعال‌شدن آپدیت هنگام وجود فعالیت نوشتنی تب دیگر.
۱۰. manifest و اجرای پوسته با worker واقعی پس از offline reload؛ نبود API در cache و برگشت وضعیت اتصال.
۱۱. ورود از لینک محصول، حفظ مقصد و پیشنهاد نصب فقط یک بار.
۱۲. بازیابی متن پروفایل پس از refresh و حذف آن با انصراف.
۱۳. بازگشت موقعیت فهرست مجازی پس از رفتن به حساب.
۱۴. غیرفعال‌شدن ذخیره هنگام درخواست پروفایل با پاسخ تأخیردار؛ این تست به‌تنهایی آزمون تمام حالت‌های logout نیست.
۱۵. خروج در نشست تأییدشدهٔ نامعتبر.
۱۶. جلوگیری از جایگزینی حساب جدید با پاسخ دیررس پروفایل قبلی.
۱۷. دو revision واقعی Service Worker: تشخیص نسخهٔ منتظر، نبود اعمال خودکار، دسترسی از حساب و حفظ draft پس از آپدیت.
۱۸. اجرای fixture قبلی warehouse: مهاجرت store قدیمی، انتخاب انبار، کنترل مقدار، جداسازی حساب/تب، رقابت submit، حفظ key در retry شبکه، موفقیت، reorder با صفحه‌کلید و نمایش responsive.

آزمون نسخهٔ جدید، نسخه‌های worker را روی origin محلی موقت سرو می‌کند و صرفاً event بروزرسانی را mock نمی‌کند. در مقابل، آزمون فعالیت تب دیگر از رکورد heartbeat fixture استفاده می‌کند. business APIها mock هستند و OTP/SMS واقعی ارسال نشده است.

### شش سناریوی جدید API

- session معتبر به context احرازشده تبدیل می‌شود.
- اختلال سرویس lookup به anonymous session تبدیل نمی‌شود.
- حساب واقعاً حذف‌شده unauthenticated می‌ماند.
- ban، وضعیت صریح مستقل باقی می‌ماند.
- اختلال context از مسیر RPCHandler به HTTP 503 سریال می‌شود.
- نبود credential، مهمان واقعی است.

۱۲ تست موفق دیگرِ اجرای کامل API متعلق به suiteهای انبار و QR موجود بودند؛ آن‌ها قابلیت جدید PWA محسوب نمی‌شوند. چهار skip مربوط به آزمون‌های live CMS/PostgreSQL/HTTP بودند و موفقیت آن‌ها ادعا نمی‌شود.

### مشکل‌های حین اجرا و نحوهٔ تعیین تکلیف

- Playwright ابتدا binary متناسب با نسخهٔ تازه را نداشت و هیچ سناریویی اجرا نشد. نصب Chromium شروع شد، اما پیشرفتی نداشت و فرایند ایجادشده برای آن متوقف شد؛ آزمون‌های موفق با Chrome نصب‌شده و `PWA_BROWSER_CHANNEL=chrome` اجرا شدند.
- لینک محصول ابتدا به‌دلیل parse عددی query و اعتبارسنجی صرفاً رشته‌ای باز نمی‌شد؛ validator اصلاح و سناریو موفق شد.
- ورود از لینک ابتدا با redirect پیش‌فرض و تأخیر ناوبری مقصد را از دست می‌داد؛ تصمیم مقصد در root/login هماهنگ و تست موفق شد.
- throw مستقیم خطای lookup در context در آزمون adapter نتیجهٔ موردانتظار نداد؛ خطا به middleware منتقل و پاسخ 503 اثبات شد.
- wrapper سناریوی warehouse ابتدا به پورت dev از قبل اشغال‌شده و dependency optimizer همان محیط برخورد کرد. نسخهٔ نهایی پورت موقت و cacheDir مجزا دارد؛ سرویس موجود دیگری برای رفع این مسئله متوقف نشد.
- resize آیکون با sharp از workspace وب در ابتدا resolve نشد؛ از sharp موجود workspace CMS برای ساخت assetها استفاده شد. پکیج تصویر جدید به وب اضافه نشد.

### خروجی build مشاهده‌شده در پایان اجرا

- PWA mode: `generateSW`، تعداد precache: ۱۴ ورودی، حدود `2028.34 KiB`.
- فایل‌های تولیدی: `dist/sw.js`، manifest و runtime hashدار Workbox.
- chunk اصلی JS حدود `1427.86 kB` خام و `421.80 kB` gzip بود؛ Vite هشدار chunk بزرگ‌تر از ۵۰۰ kB داد.
- build موفق بود؛ این اعداد معیار سرعت گوشی واقعی، INP یا cold-start نیستند. code splitting فراگیر وارد دامنه نشد.

## ۹. محدودیت‌ها و مواردی که تأیید نشده‌اند

- **[UNKNOWN] نصب واقعی Android و iPhone/Safari:** دستگاه واقعی در اختیار آزمون نبود؛ تست Chrome با viewport موبایل معادل تست نصب روی گوشی نیست.
- **[UNKNOWN] اجرای کانتینر و nginx:** Docker CLI موجود بود، اما daemon در دسترس نبود. اجرای container، `nginx -t` داخل image و headerهای واقعی آن تأیید نشدند.
- **[UNKNOWN] محیط production:** HTTPS، reverse proxy/CDN، cache headerهای بیرونی و ارتقای کاربران واقعی مشاهده نشدند.
- **[UNKNOWN] ادغام زنده API/CMS/PostgreSQL:** آزمون‌های مربوطه skip بودند؛ موفقیت واحدها به این محیط‌ها تعمیم داده نمی‌شود.
- **[UNKNOWN] رفتار کامل همهٔ مرورگرها و lifecycleهای سیستم‌عامل:** kill شدن process، storage eviction، private mode، uninstall/reinstall و تفاوت دسترسی storage در دستگاه‌های واقعی پوشش جامع ندارند.
- storage محلی تضمین نگهداری دائمی یا backup نیست. حذف داده‌های سایت می‌تواند draft و نشان هشدار محلی را حذف کند.
- idempotency موجود حفظ شده، اما نتیجهٔ نامعلوم سفارش هنوز خودکار تعیین تکلیف نمی‌شود؛ نشان هشدار، تأیید یا رد سفارش نیست.
- سطح دسترسی API/CMS کاتالوگ همان مرز دامنهٔ موجود را دارد؛ فیلتر UI یا لینک اشتراک، تضمین محرمانگی API ایجاد نمی‌کند.
- پوشش آزمون هر رفتار به سناریوهای فهرست‌شده محدود است؛ برای نمونه تست ابتدایی ماندگاری متن سبد از storage fixture استفاده می‌کند و نباید به‌عنوان پوشش مستقل تایپ تمام فرم‌های سبد معرفی شود.

## ۱۰. تحویل برای ادامهٔ کار

```text
[NEXLOAD HANDOFF]
From: PWA implementation
To: Release verification / subsequent scoped implementation
Context Pointer: .agents/brain/pwa-implementation-completion-2026-11-07.md; docs/08-pwa.md
Established Facts:
- PWA source, local builds, 18 browser scenarios and 18 API tests passed within the evidence limits recorded above.
- Final targeted worker-upgrade and warehouse regressions passed again after final changes.
- Production deployment, container runtime and real-device installation were not verified.
Hard Constraints:
- No Web Push, advanced upload, persisted API cache, automatic order replay or offline order acceptance.
- Preserve one-warehouse cart rules, server-authoritative price/reservation and existing idempotency.
- Preserve concurrent QR/CMS/contract changes; do not attribute the entire dirty worktree to PWA.
Settled Decisions:
- Custom shared install/update UI, generateSW prompt mode, explicit-logout draft deletion, product-only sharing.
Next Cognitive Objective:
- Verify the release environment and real-device behavior without reopening the agreed feature scope.
[END HANDOFF]
```
