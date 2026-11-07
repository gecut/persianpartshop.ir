# PersianPart 2.0

سامانهٔ سفارش‌گذاری B2B کاشی، سرامیک و کالاهای مرتبط، با قیمت ردهٔ مشتری و موجودی مستقل انبارها. هر سبد و سفارش از یک انبار تأمین می‌شود.

## اسناد پروژه

از [محدوده و اعتبار اسناد](docs/README.md) شروع کنید؛ این صفحه مرجع هر موضوع و تفاوت اسناد جاری، تصمیم‌ها و گزارش‌های تاریخی را مشخص می‌کند.

| سند | موضوع |
| --- | --- |
| [00 — Overview](docs/00-overview.md) | محدودهٔ محصول، قابلیت‌ها و موارد خارج دامنه |
| [01 — Models](docs/01-domain-models.md) | مدل‌های ذخیره‌شده و تفاوتشان با DTO |
| [02 — Rules](docs/02-business-rules.md) | واحد، قیمت، رزرو، لغو و retry |
| [03 — Flows](docs/03-system-flows.md) | احراز هویت، چرخهٔ سفارش و CSV |
| [04 — Permissions](docs/04-roles-and-permissions.md) | نقش‌های واقعی، مرزهای دسترسی و audit |
| [05 — Architecture](docs/05-architecture-and-contracts.md) | معماری اجرا، قرارداد و تنظیمات انتشار |
| [06 — Operations](docs/06-admin-and-operations.md) | راهنمای مدیریت، migration، seed و آزمون |
| [07 — Warehouses](docs/07-warehouses.md) | تصمیم‌های انبار و قرارداد سبد تک‌انباره |

## ساختار

- `packages/contract`: شکل API با oRPC و Zod.
- `apps/cms`: Payload روی Next.js؛ مالک داده، موجودی و چرخهٔ سفارش.
- `apps/api`: Hono روی Bun؛ دسترسی به CMS با REST SDK.
- `apps/web`: React SPA، TanStack Router/Query، HeroUI v3 و Tailwind v4.

Package manager: pnpm. فرمان‌های اجرا و شرایط آزمون در [runbook](docs/06-admin-and-operations.md) آمده‌اند. تعریف یک تنظیم در کد به معنی اجرا یا تأیید آن در محیط production نیست.
