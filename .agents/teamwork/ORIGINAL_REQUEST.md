# Original User Request

## Initial Request — 2026-11-10T13:13:43Z

اینکارو باید با یه تیم متخصص که انواع زیر عامل ها از جمله زیر عامل های متخصص امنیت و OWASP دارن بررسی کنی. پروژه را با فرض چندین هزار کاربر فعال و یک مجموعه بسیار بزرگ به طور کامل تحلیل کنید، تک به تک قسمت‌ها و ماژول‌ها را چه در سمت سرور و چه در سمت فرانت‌اند و ماژول‌های وابسته بررسی نمایید، و یک فهرست کامل از بدهی‌های فنی (Technical Debt) و موازنه‌ها (Trade-off) را در قالب یک گزارش Markdown ارائه دهید.

Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir
Integrity mode: development

## Requirements

### R1. Comprehensive Architecture and Code Analysis
Perform a detailed, module-by-module architectural and code inspection across all server-side (`apps/api`, `apps/cms`), frontend (`apps/web`), and shared contract packages (`packages/contract`), specifically evaluating system behavior and bottlenecks under a scenario of several thousand active concurrent users.

### R2. Security and OWASP Vulnerability Audit
Conduct an in-depth security audit across the entire repository following OWASP Top 10 standards, evaluating authentication/authorization mechanisms (JWT, OTP, session management), input validation, trust boundaries, and dependency vulnerabilities.

### R3. Technical Debt and Trade-Off Catalogue
Compile a structured catalogue identifying technical debts and architectural trade-offs that the system currently incurs or will face in the near future and post-production scaling, including severity ratings, potential operational impact, and recommended remediations.

### R4. Strict Report-Only Output and Zero Code Modifications
Deliver all findings solely within a single comprehensive Markdown file saved at `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` in the project root. The report must be written in Persian with standard technical English terminology. The team must NOT modify, delete, or create any source code, test, or configuration files in the repository.

## Acceptance Criteria

### File Integrity & Scope Guardrails
- [ ] No existing source code, configuration, test files, or manifests in the repository are modified or deleted (`git status --porcelain` reflects no changes to existing files).
- [ ] The report file is created strictly at the root path `TECHNICAL_DEBT_AND_AUDIT_REPORT.md`.
- [ ] The report content is written in fluent Persian accompanied by standard English technical terminology.

### Assessment Coverage & Structure
- [ ] The report contains distinct analysis sections for server components (`apps/api`, `apps/cms`), frontend components (`apps/web`), and shared contracts (`packages/contract`).
- [ ] The report includes a dedicated high-concurrency scalability analysis detailing database contention, caching, and throughput bottlenecks for thousands of active users.
- [ ] The report includes an OWASP-aligned security audit detailing potential vulnerabilities and security trade-offs.
- [ ] The technical debt section provides a structured inventory with severity classification (High/Medium/Low), operational impact, and mitigation pathways.

### Independent Verification Rubric
- [ ] An independent agent-as-judge verifies that the report satisfies all coverage requirements, cites concrete file paths and code constructs, and contains actionable, grounded evaluations without generic filler.


## Follow-up — 2026-11-10T20:56:46Z

یکی از اعضای کلیدی تیم باید مهارت `/nexload-cto-review` را اجرا کند تا بررسی و ارزیابی فنی و معماری ماژول متمرکز پیامک و صف پایگاه‌داده‌ای در CMS را طبق استانداردهای nexload-cto-review انجام داده و از نظر آمادگی پروداکشن، بررسی عدم بیش‌مهندسی (Complexity Must Pay Rent) و انطباق با قواعد مخزن نمره و رای نهایی را صادر کند.

Working directory: /Users/mm25zamanian/Codes/persianpartshop.ir
Integrity mode: demo
The team must NOT: اصلاح یا ویرایش فایل‌های کد، اعمال پچ، یا تولید کدهای اجرایی (فرایند ارزیابی صرفاً Review-Only است)

## مراجع و اسناد
- انتقال ۱۰۰٪ منطق و کلیدهای وب‌سرویس کاوه‌نگار به `apps/cms` و حذف کامل وابستگی، کلاینت و کلیدها از `apps/api`.
- ایجاد ماژول پیامک در `apps/cms/src/modules/sms/` شامل ۹ الگوی تاییدشده پروداکشن (`otp`, `order-registered`, `order-approved`, `order-cancelled`, `admin-new-order`, `admin-order-cancelled`, `supply-result`, `admin-new-supply-request`, `plan-assigned`).
- تفکیک قطعی اولویت‌ها:
  * اولویت P0 (همگام و بلاک‌کننده): پیامک OTP در هوک `beforeChange` کالکشن `otps` که در صورت شکست ارسال، ذخیره در دیتابیس را متوقف می‌کند.
  * اولویت P1 (صف پایدار پایگاه‌داده): نوتیفیکیشن‌های سفارشات، درخواست‌های تامین و طرح‌های فروش در کالکشن `sms-queue` با ورکر پس‌زمینه و تلاش مجدد ۳۰ ثانیه‌ای برای خطاهای موقت.
- مدیریت شماره‌های مدیران در تنظیمات سراسری `notification-settings` در پنل مدیریت.
- رفع قطعی ۴ بدهی فنی شناسنامه‌دار در `TECHNICAL_DEBT_AND_AUDIT_REPORT.md` شامل `TD-SEC-03`, `TD-SEC-08`, `TD-BE-09`, `TD-BE-06`.
- گزارش پیاده‌سازی و راهنما در `file:///Users/mm25zamanian/.gemini/antigravity/brain/d1084158-6e00-40e8-8dce-810e4134372b/walkthrough.md`.

## Requirements

### R1. ارزیابی معماری و آمادگی پروداکشن ماژول متمرکز پیامک CMS
بررسی فنی انتقال ۱۰۰٪ منطق و کلیدهای کاوه‌نگار به `apps/cms` و حذف کامل وابستگی از `apps/api`، تفکیک اولویت‌های P0 و P1، نحوه مدیریت ۹ الگو و تنظیمات مدیران در `notification-settings` بر اساس معیارهای آمادگی پروداکشن مهارت nexload-cto-review.

### R2. ارزیابی عدم بیش‌مهندسی (Complexity Must Pay Rent) و انطباق با قوانین مخزن
تحلیل اینکه آیا طراحی صف پایگاه‌داده‌ای `sms-queue` و تفکیک اولویت‌ها اصل عدم بیش‌مهندسی را رعایت کرده است یا خیر، و بررسی انطباق ساختار پیاده‌سازی با الزامات AGENTS.md.

### R3. راستی‌آزمایی رفع بدهی‌های فنی و پاس شدن تست‌ها
راستی‌آزمایی شواهد مربوط به رفع ۴ بدهی فنی شناسنامه‌دار (`TD-SEC-03`, `TD-SEC-08`, `TD-BE-09`, `TD-BE-06`) و راستی‌آزمایی گذر موفق ۱۰۰ تست واحد با اجرای دستور `pnpm --filter @persianpart/cms test:hardening` و بررسی تایپ‌چک سراسری بدون وابستگی به سرویس‌های زنده خارجی.

### R4. تدوین و صدور گزارش رسمی ارزیابی CTO
ارائه گزارش نهایی مطابق چارچوب رسمی nexload-cto-review شامل:
1. ارزیابی معماری و آمادگی پروداکشن
2. تحلیل اصل Complexity Must Pay Rent
3. نمره عددی و کیفی
4. رای نهایی صریح (Approved / Rejected / Conditional)
5. حداکثر ۳ یافته کلیدی، مادی و قابل‌ردیابی در کد، بدون اعمال تغییر یا تولید پچ کد.

## Acceptance Criteria

### گزارش ارزیابی معماری و صدور رای
- [ ] گزارش مکتوب ارزیابی شامل تمام بخش‌های چارچوب nexload-cto-review تدوین شده باشد.
- [ ] نمره ارزیابی و رای نهایی (Verdict) به صورت شفاف و مستند اعلام شده باشد.
- [ ] یافته‌ها به حداکثر ۳ مورد اساسی محدود بوده و هیچ‌گونه فایل کد یا پچی تغییر نیافته یا اضافه نشده باشد (کاملاً Review-Only).
- [ ] برطرف شدن ۴ بدهی فنی TD-SEC-03، TD-SEC-08، TD-BE-09 و TD-BE-06 با ارجاع دقیق به کد راستی‌آزمایی شده باشد.
- [ ] اجرای موفق ۱۰۰ تست واحد در `apps/cms test:hardening` و بررسی تایپ‌چک مستقل تایید شده باشد.
