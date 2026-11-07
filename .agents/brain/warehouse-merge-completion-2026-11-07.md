# اجرای تکمیل ادغام انبار — ۲۰۲۶/۱۱/۰۷

مرجع تصمیم‌ها: `handoff-warehouse-rebase-2026-11-07.md`؛ حفظ remote، لغو ۶۰ دقیقه، سبد تک‌انباره، واحد اصلی هر کالا.

## اقدامات و ترتیب اجرا

- [x] بررسی backup و همگامی HEAD با origin/main، بازبینی و stage کردن ۱۶ مسیر تعارض؛ صفر ورودی unmerged.
- [x] اصلاح نقش seed و منع دسترسی پشتیبانی به قیمت/موجودی.
- [x] محدودکردن rollback تست به migrationهای انبار.
- [x] آماده‌سازی PostgreSQL مستقل روی loopback:55439؛ بدون تغییر DB کاری.
- [x] اجرای migrationها و مقایسه با metadata واقعی؛ کشف nullable بودن plans.title و افزودن migration اصلاحی بدون حذف داده.
- [x] تکمیل کنترل دسترسی تمام ورودی‌های کاتالوگ/shopping/quote و خطای lookup مشتری.
- [x] تطبیق واحدهای کاشی/غیرکاشی در quote، snapshot، cart، preinvoice و invoice.
- [x] بررسی ثبت، retry، لغو، بازگرداندن موجودی، سفارش مجدد و race حساب/تب.
- [x] تکمیل fixture غیرکاشی و اثبات seed دوباره بدون reset موجودی.
- [x] اجرای تست‌های PostgreSQL، CSV، API و مرورگر در موبایل و دسکتاپ.
- [x] تولید types/importMap و typecheck/build نهایی و بررسی Git.
- [x] به‌روزرسانی مستندات و ثبت شواهد نهایی؛ خاموش‌کردن سرویس‌های آزمایشی.

## شواهد تا این مرحله

پیش از اصلاح‌های جاری: typecheck هر سه برنامه، build وب/CMS، ۷۲ تست CMS و ۴ تست API موفق بود.
پس از اصلاح schema: full migration + schema metadata + Local API CRUD/lifecycle + CSV auth/preview/apply/replay/tamper + warehouse down روی DB موقت موفق شد.
آزمون plan ناخواسته hook پیامک remote را فراخواند؛ ارائه‌دهنده پاسخ ۴۱۲ داد. تست‌ها باید پیش از import config مقدار DISABLE_SMS=true را تنظیم کنند؛ تست مجدد بدون تماس خارجی اجرا می‌شود.


## نتیجهٔ نهایی و شواهد

- Git: هر ۱۶ مسیر unmerged حل و stage شد؛ `git ls-files -u` خروجی خالی؛ `HEAD...origin/main` برابر `0 0`؛ ref بازیابی `refs/codex/pre-rebase-20261107-085624` حفظ شد. commit/push انجام نشد. تغییرات نامرتبط قبلی مخزن حفظ شدند؛ ادعای clean بودن کل working tree وجود ندارد.
- اصلاح‌ها: کنترل fail-closed خطای lookup مشتری، مجوز دسته‌بندی و stock مخفی در shopping و calculator، محاسبهٔ واحد اصلی در API/CMS، snapshot نوع/واحد/ضریب، جمع جداگانهٔ واحدها در سبد/جزئیات/فهرست/فاکتور، حذف تخفیف نمایشی بدون پشتوانه، لغو فقط پس از پاسخ موفق سرور، جلوگیری از نمایش کش یا پاسخ دیررس سفارش پس از خروج از حساب.
- CMS: `test:hardening` تعداد ۷۲ pass، صفر failure/skip.
- PostgreSQL: `test:hardening:postgres` تعداد ۸ pass، صفر failure/skip روی `cms_hardening_test` پورت ۵۵۴۳۹.
- migration: زنجیرهٔ ۹ migration روی DB تصادفی، تطبیق تمام ستون‌ها/nullability/index/FK با metadata، CRUD واقعی، CSV auth/preview/apply/replay/tamper، rollback چندردیفی، invalidation نسخهٔ محصول، audit در تراکنش، mixed-unit reserve/cancel و ممنوعیت تغییر واحد کالای دارای balance موفق؛ rollback چهار migration انبار نیز موفق.
- API: شش تست mock واحد موفق. سه تست opt-in واقعی در `warehouse.live.test.ts` با ۲۶ assertion موفق؛ quote/submit/replay/cancel/مهلت ۶۰ دقیقه، مجوز مسیرهای shopping/catalog و HTTP واقعی Hono با JWT آزمایشی و رد درخواست ناشناس. اجرای معمول API سه تست live را عمداً skip می‌کند؛ مدرک موفقیت live اجرای جداگانهٔ صریح آن‌هاست.
- seed: دو اجرای موفق روی `cms_seed_merge`؛ ۲۸ محصول (۲۶ tile، دو other) و ۵۶ balance. تمام موجودی‌ها و revisionها قبل/بعد seed دوم با `cmp` برابر، شامل edit دستی و رزرو سفارش‌ها.
- Browser: Chromium با mock جدید session/profile، legacy migration، zero/one/multiple warehouse، حفظ سبد در شکست، پاسخ دیررس حساب، دو تب، حفظ ویرایش حین submit، retry با همان key، keyboard reorder و سفارش تازه، mixed-unit preinvoice و invoice، نبود تخفیف ساختگی، logout و پاسخ دیررس سفارش؛ اجرای نهایی در session تازهٔ pp-final با exit 0. viewportهای ۳۶۰/۱۲۸۰ و screenshots بررسی شدند. جدول فاکتور در موبایل اسکرول افقی داخلی دارد؛ صفحه overflow افقی ندارد.
- Browser + CMS واقعی: ورود manager، انتخاب انبار دوم، preview/apply موجودی CSV و پیام موفقیت، نماهای ۳۶۰/۱۲۸۰؛ بدون mock در CMS.
- generate:types/importmap، typecheck API/CMS، build نهایی Web/CMS و frozen offline lockfile check موفق. Web هشدار chunk بزرگ دارد.
- محیط‌های تست: PostgreSQL پورت ۵۵۴۳۹، Web ۵۵۱۷۳، CMS ۵۵۱۷۴، API ۵۵۱۷۵؛ پس از آزمون متوقف می‌شوند. سرویس ازقبل‌موجود ۵۱۷۳ متعلق به این اجرای آزمایشی نبود و دست‌نخورده ماند.

## محدودیت عملیاتی

دیتابیس کاری `persianpart_cms` migrate/reset/seed نشد؛ تست‌ها روی DB مستقل بودند. migration انتساب انبار روی سفارش تاریخی غیرخالی عمداً متوقف می‌شود؛ اجرای آن روی دادهٔ واقعی نیازمند انتساب تاریخی مصوب است. این کار شامل deploy یا روشن‌کردن دائمی dev نیست. فروش other مطابق رفتار remote فعلی به واحد کامل گرد می‌شود؛ مقدار کسری کیلوگرم/لیتر در این نسخه ادعا نمی‌شود. پیامک در اجرای اول تست به‌اشتباه فراخوانی و با پاسخ ۴۱۲ رد شد؛ تست اکنون DISABLE_SMS را پیش از import config تنظیم می‌کند و اجراهای بعدی بدون ارسال بودند.
