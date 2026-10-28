# پلن اجرایی: بازطراحی کامل استایل و تم پنل ادمین Payload CMS 3

> **وضعیت**: آماده برای اجرا  
> **دامنه سطح تغییر**: صرفاً فایل `apps/cms/src/app/(payload)/custom.css`  
> **نسخه هدف**: Payload CMS v3.90.2 (@payloadcms/ui / @payloadcms/next)  
> **استاندارد معماری**: AGENTS.md + Nexload Design + Taste-Skill (Anti-Slop Enterprise Adaptation)

---

## ۱. زمینه و چارچوب مسئله (Problem & Context)

پنل ادمین فعلی دارای یک فایل سفارشی ۶۰۰ خطی (`custom.css`) است که فونت وزیرمتن و راست‌چین‌سازی پایه را اعمال کرده، اما با چالش‌های زیر روبروست:
1. **تداخل‌های اولویت (`!important`) نامتعادل**: متغیرهای رنگی با `!important` روی دکمه‌ها و فیلدها باعث بی‌اثر شدن استایل‌های پیش‌فرض حالت‌های Disabled و Error شده‌اند.
2. **عدم یکپارچگی سیستم توکن**: استایل‌ها مستقیماً با سلکتورهای عمیق بازنویسی شده‌اند به جای اتکا به لایه توکن‌های رسمی Payload (`--theme-bg`, `--theme-elevation-*`, `--style-radius-*`).
3. **ناهماهنگی هندسی در RTL**: استفاده از ویژگی‌های فیزیکی (`left`, `right`, `margin-left`) به جای ویژگی‌های منطقی مدرن (`inset-inline`, `margin-inline`).
4. **ظاهر پیش‌فرض و غیرتخصصی**: عدم استفاده از پالت رنگی حرفه‌ای (پرهیز از گرادیان‌های بنفش کلیشه‌ای هوش مصنوعی و رعایت تضاد رنگی WCAG AA).

---

## ۲. مشخصات طراحی (Design Tokens & Taste Spec)

- **فلسفه بصری**: طراحی مدرن، خنثی، مهندسی‌شده و متمرکز بر داده (B2B Enterprise Clean).
- **پالت پایه**: 
  - در حالت روشن: پس‌زمینه‌های Slate/Zinc نرم (`#f8fafc` و `#ffffff`) با بوردرهای تفکیک‌کننده یکپارچه (`#e2e8f0`).
  - در حالت تیره: پس‌زمینه‌های گرافیتی عمیق بدون سیاهی مطلق (`#090d16` و `#0f172a`) با تراز کنتراست دقیق.
  - رنگ اکسنت (Accent): کبالت مهندسی‌شده (`#2563eb` روشن، `#3b82f6` تیره) بدون درخشش نئونی و بدون بنفش پیش‌فرض AI.
- **تایپوگرافی**: فونت یکدست `Vazirmatn Variable` همراه با فعال‌سازی ارقام فارسی استاندارد برای متون و ارقام تراز عرضی (`tnum`) برای داده‌های جدولی.
- **شعاع‌ها (Radius)**: یکپارچه‌سازی مقیاس شعاع به صورت `--style-radius-s: 6px`، `--style-radius-m: 8px` و `--style-radius-l: 12px` (پرهیز از دکمه‌های کاملاً بیضی در کنار کارت‌های گوشه‌تیز).

---

## ۳. فازهای گام‌به‌گام اجرا (5-Part Executable Specification)

### فاز ۱: بازسازی معماری متغیرها و لایه توکن‌ها (Token Foundation)

- **تصمیم (Decision)**: تمامی رنگ‌ها و ابعاد در ریشه `:root` و `[data-theme='dark']` به صورت توکن‌های همگام با معماری Payload تعریف شوند.
- **مسیر (Path)**: `apps/cms/src/app/(payload)/custom.css` (بخش ابتدایی، خطوط ۱ تا ۱۰۰)
- **اقدام (Action)**:
  1. مقداردهی متغیرهای رسمی Payload:
     - `--theme-bg`
     - `--theme-input-bg`
     - `--theme-text`
     - `--theme-elevation-0` تا `--theme-elevation-1000`
     - `--style-radius-s`, `--style-radius-m`, `--style-radius-l`
     - `--accessibility-outline` و `--accessibility-outline-offset`
  2. تعریف پالت اکسنت برند و حالات هاور/فوکوس بدون استفاده از `!important` در تعاریف ریشه.
  3. اعمال تنظیمات جامع تایپوگرافی و فیچرهای اپن‌تایپ اعداد فارسی بر روی کل بدنه.
- **تست (Test)**:
  - اجرای کامپایلر: `pnpm --filter @persianpart/cms exec tsc --noEmit`
  - بررسی عدم بروز خطای سینتکس CSS در بیلد آزمایشی.
- **شرط توقف (Stop Condition)**: تغییر متغیر تم بین تیره و روشن در کنسول مرورگر فوراً تمام سطوح پایه و رنگ متن را بدون نیاز به رفرش بازآرایی کند.

---

### فاز ۲: ساختار ناوبری، هدر و چارچوب RTL (Shell & Navigation)

- **تصمیم (Decision)**: بازطراحی سایدبار، هدر اپلیکیشن و ناوبری بردکرامب با استفاده از ویژگی‌های منطقی مدرن (`*-inline`).
- **مسیر (Path)**: `apps/cms/src/app/(payload)/custom.css` (خطوط ۱۰۱ تا ۲۵۰)
- **اقدام (Action)**:
  1. استایل‌دهی مجدد به `.app-header` و `.nav` با حاشیه‌های ظریف و پدینگ‌های هماهنگ با مقیاس ۸ پیکسلی.
  2. استایل وضعیت فعال منوها (`.nav__link--active`) با نشانگر خطی ظریف در لبه آغازین (`inset-inline-start`) به جای پس‌زمینه‌های پررنگ زننده.
  3. تصحیح بردکرامب (`.step-nav`) و جهت جداکننده‌ها در ساختار راست‌به‌چپ بدون چرخش‌های شکسته.
- **تست (Test)**:
  - بررسی ناوبری در رزولوشن دسکتاپ (عرض بالای ۱۲۸۰) و تبلت/موبایل (عرض زیر ۷۶۸).
- **شرط توقف (Stop Condition)**: منوی کناری بدون بیرون‌زدگی افقی در هر دو حالت باز و بسته روان کار کند و آیکون‌ها تقارن RTL را حفظ کنند.

---

### فاز ۳: فرم‌ها، فیلدها و انتخاب‌گرها (Forms, Inputs & React-Select)

- **تصمیم (Decision)**: اصلاح کنترل‌های ورودی، حذف `!important` از پالت‌های ورودی جهت احیای وضعیت‌های ارور و غیرفعال.
- **مسیر (Path)**: `apps/cms/src/app/(payload)/custom.css` (خطوط ۲۵۱ تا ۴۲۰)
- **اقدام (Action)**:
  1. یکسان‌سازی ارتفاع و فواصل پدینگ فیلدهای ورودی (`input`, `textarea`, `.rs__control`).
  2. استایل‌دهی حلقه فوکوس دسترس‌پذیر (`:focus-visible`) با استفاده از توکن `--accessibility-outline`.
  3. رفع مشکلات منوی دراپ‌داون React-Select (`.rs__menu`, `.rs__option`) در چینش راست‌چین و هایلایت آیتم فعال.
  4. استایل مجدد برچسب‌ها (`.field-label`)، راهنماها (`.field-description`) و برچسب‌های ارتباطی چندگانه (Pills/Tags).
  5. بازطراحی ادیتور لکسیکال (`.rich-text-lexical`) جهت جریان متنی صحیح در ویرایش متون فارسی.
- **تست (Test)**:
  - ورود داده در صفحه ویرایش محصول (`/admin/collections/products/:id`).
  - فعال‌سازی خطای ولیدیشن (خالی گذاشتن فیلد اجباری) و تأیید نمایش کادر قرمز خطا.
  - تست فیلد غیرفعال (`disabled`) و تأیید خاکستری و غیرقابل‌کلیک بودن آن.
- **شرط توقف (Stop Condition)**: فیلدهای عددی، دراپ‌داون‌های رابطه و ادیتور متنی بدون پرش یا اسکرول ناخواسته فوکوس را نمایش دهند.

---

### فاز ۴: دکمه‌ها، جدول‌ها و کارت‌های احراز هویت (Buttons, Tables & Auth)

- **تصمیم (Decision)**: بازطراحی جدول‌های داده و کارت صفحه ورود مطابق استانداردهای مینیمال و داده‌محور.
- **مسیر (Path)**: `apps/cms/src/app/(payload)/custom.css` (خطوط ۴۲۱ تا پایان)
- **اقدام (Action)**:
  1. متغیرهای دکمه اولیه (`.btn--style-primary`) به گونه‌ای تنظیم شوند که کلاس `.btn--disabled` بتواند ظاهر غیرفعال را به درستی اورراید کند.
  2. جدول‌های فهرست (`.table`): خطوط افقی مویی، هاور ردیف ملایم، پدینگ فشرده برای دیدن ردیف‌های بیشتر در یک نگاه و هدرهای متمایز.
  3. استایل صفحه‌بندی (`.pagination`) و پیل‌های وضعیت انتشار (`.pill`).
  4. بازطراحی فرم ورود (`.template-minimal__wrap`): کارت مدرن با سایه ملایم هماهنگ با تم، فرم منظم و دکمه ورود متناسب.
- **تست (Test)**:
  - باز کردن `/admin/login` و بررسی تراز افقی و عمودی.
  - باز کردن `/admin/collections/products` و بررسی فهرست داده‌ها و انتخاب ردیف‌ها.
- **شرط توقف (Stop Condition)**: تمام دکمه‌ها و عناصر تعاملی بازخورد لمسی مناسب (`scale-[0.99]` یا ترنزیشن نرم) داشته باشند و کنتراست متن دکمه‌ها حداقل 4.5:1 باشد.

---

## ۴. برنامه جامع راستی‌آزمایی (Verification & Claim-Matched Acceptance)

تمام تست‌ها باید بدون دست‌کاری کدهای جاوااسکریپت و بدون تغییر فایل‌های خارج از `custom.css` پاس شوند:

1. **بررسی خطای نوع و کامپایل**:
   ```bash
   pnpm --filter @persianpart/cms exec tsc --noEmit
   ```
2. **بررسی تولید بیلد پروداکشن**:
   ```bash
   pnpm --filter @persianpart/cms build
   ```
3. **بازرسی بصری روت‌های هدف (روی پورت ۵۱۷۴)**:
   - `/admin/login`: کارت ورود، تقارن لوگو، خوانایی متون و تضاد دکمه.
   - `/admin/collections/products`: تراکم جدول، ستون‌های وضعیت، فیلترها و راست‌چین بودن جستجو.
   - `/admin/collections/products/create`: تب‌ها، فیلدهای دراپ‌داون، لکسیکال و استایل فیلدهای اجباری.
   - تغییر تم زنده: بررسی بی‌نقص بودن همگام‌سازی تم روشن و تم تیره در تمام این روت‌ها.
   - بررسی حالت‌های خاص: ورودی نامعتبر (Error State)، دکمه ذخیره در حال ارسال (Disabled State).

---

## ۵. تحویل و محدودیت‌ها (Boundaries & Handoff)

```text
[NEXLOAD HANDOFF]
From: Architect / Planner
To: Implementation Agent
Context Pointer: apps/cms/src/app/(payload)/custom.css
Established Facts:
- Payload CMS 3.90.2 is installed with Next.js app router.
- Entry point layout.tsx already imports custom.css immediately after @payloadcms/next/css.
- RTL direction is globally active via dir="rtl".
Hard Constraints:
- Changes restricted strictly to custom.css.
- Zero TS/TSX modifications.
- Preserve Persian numeral normalization behavior in admin-enhancements.tsx.
Next Cognitive Objective:
- Apply Phase 1 to Phase 4 styling sequentially and run verification gates.
[END HANDOFF]
```
