> گزارش تاریخی اجرای پیش از rebase؛ نتیجهٔ نسخهٔ ادغام‌شده در [گزارش تکمیل](warehouse-merge-completion-2026-11-07.md) ثبت است.

# اجرای تفکیک انبار — ۲۰۲۶/۱۱/۰۷

وضعیت: پیاده‌سازی کد و راستی‌آزمایی در محیط موقت انجام شد. روی دیتابیس کاری reset یا migration اجرا نشده و انتشار انجام نشده است.

## تحویل

- انبار و balance یکتای محصول/انبار؛ محدودیت DB بر مقدار و revision؛ مجوز مدیریت برای manager/superadmin و خواندن محدود ماشین.
- رزرو شرطی و بازگرداندن در تراکنش همان سفارش؛ انبار و snapshot تاریخی immutable؛ ترتیب قفل ثابت؛ محافظت رقابت تغییر بسته‌بندی.
- قرارداد و API availability با قیمت نهایی، عدم تجمیع، pagination و خواندن دسته‌ای؛ دو مسیر submit مشترک؛ fingerprint کلید تکرار شامل انبار و payload؛ توقف سفارش اختصاصی.
- یک draft مرورگری به تفکیک حساب؛ adapter مشترک سبد/انتخاب؛ مهاجرت دادهٔ قدیمی، انتخاب شرطی انبار، جلوگیری از overwrite پاسخ قدیمی و حفظ ویرایش حین submit؛ سفارش مجدد با موجودی و انتخاب تازه.
- CMS مدیریت انبار، موجودی و کارتن مشتق‌شده؛ CSV مستقل انبار با preview امضاشده، expiry، CAS و اعمال اتمیک؛ export و ورود دستی از همان مسیر؛ import قیمت جدا.
- seed دو انبار و balanceهای پایدار و guard مقصد اصلاح‌شده؛ سه migration افزایشی و راهنمای عملیاتی `docs/07-warehouses.md`.

## شواهد اجرا

- `pnpm --filter @persianpart/cms test:hardening`: تعداد ۷۲ تست، بدون شکست یا skip.
- `pnpm --filter @persianpart/api test`: تعداد ۴ تست availability، قیمت نهایی، authentication، idempotency و توقف custom order، بدون شکست.
- `test:hardening:postgres`: تعداد ۸ تست روی PostgreSQL محلی موقت؛ race رزرو/لغو، isolation انبار، rollback و CAS ورودی کهنه گذشتند.
- `test:hardening:migrations`: زنجیرهٔ کامل migration، تطبیق schema با metadata، چرخهٔ واقعی Payload و preview/apply/مجوز/replay/tamper CSV گذشت. rollback migrationهای جدید نیز گذشت.
- seed دو بار روی DB موقت دارای schema اجرا شد؛ مقایسهٔ قبل/بعد تمام ۵۲ balance، شامل ویرایش دستی و رزروها، برابر بود.
- مرورگر واقعی با API mock: انتخاب صفر/یک/چند انبار، انتخاب با صفحه‌کلید، مهاجرت دو store قدیمی، cart حفظ‌شده، تغییر حساب، دو تب، پاسخ submit پس از ویرایش، network retry با همان key، ثبت موفق و reorder با انبار تازه گذشت. فایل قابل تکرار: `apps/web/e2e/warehouse.js`.
- مرورگر واقعی به CMS تولیدشده و DB موقت متصل شد: ورود manager، انتخاب انبار، پیش‌نمایش و اعمال CSV و نماهای ۳۶۰ و ۱۲۸۰ پیکسل بررسی شدند.
- API router با SDK واقعی به CMS REST و PostgreSQL متصل شد: quote، submit، replay، cancel و برابری موجودی قبل/بعد گذشت. این بررسی با `call` و context fixture انجام شد، نه OTP/SMS واقعی.
- typecheckهای CMS/API/Web و buildهای CMS/Web گذشتند. build وب همچنان هشدار اندازهٔ chunk دارد.

## انتشار و محدودیت‌ها

- مقصد DB کاری هنوز تعیین/تأیید نشده است. هیچ credential یا فایل env کاری تغییر نکرده؛ envهای آزمایش فقط به فرایندهای موقت داده شدند.
- migration اتصال سفارش روی جدول orders غیرخالی با پیام صریح متوقف می‌شود؛ انتساب تاریخی حدسی انجام نمی‌شود. اجرای beta reset نیازمند مقصد مجاز است.
- ستون‌های قدیمی stock محصول برای سازگاری schema باقی‌اند، اما مخفی و غیرقابل نوشتن از REST هستند و در منطق فروش استفاده نمی‌شوند.
- rollback قدیمی OTP در تاریخچه خطای قبلی در ترتیب حذف constraint دارد؛ بازنویسی نشده است. rollback بررسی‌شده متعلق به migrationهای جدید این فیچر است.
- تازگی شمارش فایل قبل از upload قابل اثبات نیست؛ اپراتور باید موجودی قابل فروش تازه بدهد. CAS فقط از تغییر پس از preview محافظت می‌کند.
- مرورگر Chromium بررسی شد؛ ادعای بررسی Safari/iOS یا screen reader دستی نشده است.
