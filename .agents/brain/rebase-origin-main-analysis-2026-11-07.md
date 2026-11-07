> Historical artifact. The merged result and verification are recorded in [merge completion](warehouse-merge-completion-2026-11-07.md); current product documentation starts at [docs/README](../../docs/README.md). Original decisions/text below are retained.

# تحلیل همگام‌سازی origin/main و کار محلی — ۲۰۲۶/۱۱/۰۷

## وضعیت واقعی

- مبنای قبلی: `8c39a55`؛ remote دریافت‌شده: `54eda5f`؛ دقیقاً ۲۱ کامیت remote و صفر کامیت محلی اضافه.
- تغییر remote: 89 فایل؛ 17,575 خط اضافه و 2,780 خط حذف. از اضافه‌ها 10,303 خط متعلق به snapshotهای migration است؛ تعداد خطوط معیار تعداد قابلیت نیست.
- سرورهای dev روی ۵۱۷۳/۵۱۷۴/۵۱۷۵ متوقف و نبود listener تأیید شد. PostgreSQL سیستمی متوقف نشده است.
- `git rebase origin/main` موفق شد؛ main اکنون با remote برابر است. تعارض‌های فعلی مربوط به `git stash apply` برای کار ثبت‌نشده‌اند؛ rebase sequencer باز نیست.
- ۲۳ مسیر تغییر محلی/remote هم‌پوشانی داشتند؛ ۱۶ فایل هنگام apply تعارض متنی پیدا کردند. هیچ تعارضی دستی حل نشده است.
- ۸۷ فایل untracked قبلی با SHA-256 قبل/بعد تطبیق داده شدند؛ هیچ اختلافی نبود. تغییرات skillها و اسناد قدیمی نیز محفوظ‌اند.
- هیچ push، commit جدید، deploy، reset دیتابیس یا اجرای migration در این نوبت انجام نشده است.

## جمع‌بندی دامنه و ریسک ادغام

1. **مشتری و دسترسی:** مدارک و پروفایل، ban/status، فقط‌مشاهده‌بودن، مخفی‌کردن موجودی و allowedCategories اضافه شده‌اند. endpoint جدید availability و adapterهای موجودی باید همین policyها را حفظ کنند؛ صرف auto-merge فایل کافی نیست.
2. **محصول و واحد:** remote کالای غیرکاشی و واحد فروش/واحد ثانویه دارد و موجودی غیرکاشی را به‌عنوان تعداد/مقدار واحد فروش مصرف می‌کند؛ مدل انبار محلی برای متراژ کاشی نوشته شده است. تبدیل بی‌صدای موجودی کیسه/عدد به متر مربع درست نیست.
3. **سفارش:** remote edit flow را حذف کرده و refresh موجودی دارد؛ محلی هم edit جعلی را حذف کرده، اما draft و idempotency و رزرو را تغییر داده است. مهلت لغو API در remote از ۳۰ به ۶۰ دقیقه رسیده؛ تصمیم محصول لازم است.
4. **طرح، فاکتور و UI:** refactor طرح‌های فعال، فیلتر مشتری و صفحه‌بندی ۲۴/۱۲، لوگوی CDN و چندین تغییر چاپ/فاکتور وجود دارد. انتخاب کامل نسخهٔ محلی برای فایل‌های مشترک این امکانات را از بین می‌برد.
5. **CMS و داده:** نقش‌های UI به مدیر/مدیرکل و ماشین محدود شده‌اند؛ audit logs و دو migration جدید وجود دارند. seed محلی به‌طور متنی merge شده ولی با گزینه‌های نقش و schema جدید سازگاری آن هنوز تأیید نشده است.
6. **migration و rollout:** prodMigrations به آداپتر اضافه شده است؛ این فقط پیکربندی اجرای خودکار است، نه اثبات zero-downtime. snapshotهای migration انبار از مبنای قدیمی ساخته شده‌اند؛ پس از تصمیم ادغام باید types/schema/migrations مجدداً تطبیق و تست شوند.
7. **دیتابیس فعلی:** DB محلی پیش از دریافت این ۲۱ کامیت ساخته شده؛ با schema جدید remote یکسان فرض نمی‌شود. تا حل تعارض و کنترل migrationها dev نباید دوباره اجرا شود.

## فهرست ۲۱ کامیت

| کامیت | اثر بررسی‌شده |
| --- | --- |
| `9fd64ad` | گسترش حساب مشتری/مدارک، نقش‌ها و audit log؛ کالای غیرکاشی و واحد فروش؛ تغییرات API، کاتالوگ، طرح و UI در ۶۵ فایل. |
| `a8c36d9` | تغییر مدیریت فعال‌بودن طرح و محصول، دادهٔ نمونه و UI مرتبط؛ ۳۰ فایل. |
| `935f3e2` | اضافه‌شدن migration بزرگ دامنهٔ جدید و snapshot آن، همراه اصلاح احراز هویت و پیش‌فاکتور. |
| `2a9c167` | پاک‌سازی cache در logout، بازنگری آپلودها و افزایش محدودیت اندازهٔ درخواست. |
| `3f6e55b` | حذف یک خط از Dockerfile وب؛ عنوان commit توضیحی ندارد. |
| `246227d` | حذف ویرایش سفارش و تازه‌سازی موجودی محصولات پس از ثبت/لغو. |
| `c378ab1` | لوگوی CDN در هدر، ورود، فاکتور و favicon. |
| `ff1806e` | تنظیم radius لوگو و کارت‌ها در چاپ فاکتور. |
| `7bf437a` | چیدمان ستون‌های فاکتور کاشی و سرامیک. |
| `4f0935f` | نمایش واحد تومان در جمع‌های مالی فاکتور. |
| `737a7c8` | وسط‌چین چاپ، header جدول، کنتراست تخفیف و tokenهای HeroUI. |
| `99b8971` | اصلاح بارگذاری لوگو، حذف banner تخفیف خالی و responsive فاکتور. |
| `a41df87` | خلاصه‌سازی مشخصات، عرض ستون قیمت و ظاهر جدول فاکتور. |
| `b622b05` | محدودیت دسته‌بندی مشتری، infinite scroll محصول/طرح و زمان‌سنج بررسی سفارش. |
| `f62f2d0` | اصلاح فاصله‌های چاپ، حاشیه‌ها و header فاکتور. |
| `e26ff33` | فیلد و migration واحد ثانویه؛ badge محصول و تعامل کارت طرح. |
| `858c99b` | اصلاح نمایش badge و واحد ثانویهٔ کارت محصول؛ عنوان commit توضیحی ندارد. |
| `bc050cb` | دو فایل تولیدی Next.js/TypeScript؛ تغییر تجاری مستقلی اثبات نمی‌کند. |
| `501dc34` | ثبت prodMigrations در آداپتر PostgreSQL؛ عنوان «zero-downtime» تضمین عملیاتی اثبات‌شده نیست. |
| `f0fa0c2` | حذف badge ثانویهٔ خالی و نمایش فقط‌خواندنی محصولات طرح؛ انتقال انتخاب طرح به /product. |
| `54eda5f` | اصلاح جزئی کارت طرح؛ عنوان commit توضیحی ندارد. |

## تعارض‌های واقعی و موضوع ادغام

| فایل | موضوع |
| --- | --- |
| `apps/api/src/routers/catalog.ts` | فیلتر دسترسی و مخفی‌کردن موجودی remote در کنار summary موجودی انبار محلی. |
| `apps/api/src/routers/order.ts` | مجوز سفارش/دسته‌بندی و stock check remote در برابر رزرو انبارمحور، fingerprint و توقف custom order محلی؛ ۶۰ در برابر ۳۰ دقیقه. |
| `apps/cms/src/collections/orders/_apply-reservation.before-change.ts` | موجودی global محصول در برابر رزرو/restore روی warehouse balance. |
| `apps/cms/src/collections/products/_sync-slug-and-dimensions.before-validate.ts` | مدل محصول غیرکاشی و مقدار اختیاری بسته‌بندی در برابر lock و اعتبارسنجی محلی. |
| `apps/cms/src/collections/products/components/ProductPreview.tsx` | پیش‌نمایش واحدهای جدید در برابر انتقال نمایش موجودی به انبار. |
| `apps/cms/src/collections/products/products.collection.ts` | فیلدهای جدید و واحدها در برابر مخفی/غیرقابل‌نوشتن‌شدن stock قدیمی. |
| `apps/cms/src/migrations/index.ts` | حفظ ترتیب دو migration remote و سه migration انبار؛ snapshotهای محلی باید با schema جدید تطبیق یابند. |
| `apps/cms/src/payload.config.ts` | AuditLogs و prodMigrations remote همراه Warehouses/Stock و تفکیک import محلی. |
| `apps/web/src/features/checkout/pre-invoice-modal.tsx` | حذف edit flow و refresh موجودی remote در برابر warehouse binding و پاسخ قطعی submit محلی. |
| `apps/web/src/features/orders/order-store.ts` | چرخهٔ سفارش/refresh remote در برابر حذف سفارش محلیِ جعلی و draft مشترک. |
| `apps/web/src/features/products/product-store.ts` | واحدهای جدید، محدودیت‌ها و infinite scroll در برابر stock انبار و قیمت quote. |
| `apps/web/src/routes/__root.tsx` | احراز هویت/دسترسی remote همراه مالکیت draft و انتخاب انبار محلی. |
| `apps/web/src/routes/orders/$id.tsx` | تغییرات UX و مهلت سفارش remote همراه snapshot انبار و reorder تازه. |
| `apps/web/src/routes/product/index.tsx` | فیلترهای دسترسی/infinite scroll و UI remote همراه افزودن async و انتخاب انبار. |
| `apps/web/src/routes/product/new.tsx` | حذف edit flow و محدودیت دسترسی remote؛ حذف خودکار کالای ناموجود در برابر سیاست حفظ draft محلی. |
| `packages/contract/src/order.ts` | خطاها و قرارداد remote همراه warehouseId و DTO typed محلی. |

## مسیر پیشنهادی پس از تصمیم کارفرما

- حفظ تغییرات remote و انتقال قابلیت انبار به همین معماری، با تقدم موجودی انبارمحور بر stock global و حفظ policyهای امنیتی/مشتری remote.
- تعیین مهلت لغو و دامنهٔ انبار برای محصولات غیرکاشی پیش از حل تعارض رفتاری.
- تولید مجدد types/import map و تطبیق snapshotهای migration؛ سپس typecheck و تست API، lifecycle/CAS، schema و مرورگر.
- این یک پیشنهاد است؛ مطابق درخواست کارفرما هیچ تعارضی پیش از پاسخ او حل نمی‌شود.

## بازیابی امن

- شاخهٔ مبنای قبلی: `codex/backup-pre-rebase-20261107-085624`.
- snapshot کامل کار: `285129bec2e6ef43b3fd765756019c24860f01b7`؛ stash پاک یا pop نشده است.
- ref پایدار snapshot: `refs/codex/pre-rebase-20261107-085624`.
- patchها، وضعیت اولیه و manifest: `/Users/mm25zamanian/Codes/persianpartshop.ir/.git/codex-backups/rebase-20261107-085624`.
- وضعیت فعلی دارای conflict marker است؛ build یا تست موفقِ نسخهٔ ادغام‌شده ادعا نمی‌شود.

## فایل‌های تغییرکرده در remote

- `apps/api/src/client.ts`
- `apps/api/src/routers/auth.ts`
- `apps/api/src/routers/catalog.ts`
- `apps/api/src/routers/order.helpers.ts`
- `apps/api/src/routers/order.ts`
- `apps/api/src/routers/plan.ts`
- `apps/api/src/routers/router.helpers.ts`
- `apps/api/src/routers/user.ts`
- `apps/api/src/rpc/base.ts`
- `apps/api/src/rpc/context.ts`
- `apps/api/src/server.ts`
- `apps/cms/media/2026-10-22 16.55.58.webp`
- `apps/cms/media/3d-percent-badge-cyan-1.webp`
- `apps/cms/media/3d-percent-badge-cyan.webp`
- `apps/cms/media/Airplane_taking_off_from_Tehran_7369e380_2K-1.webp`
- `apps/cms/media/Airplane_taking_off_from_Tehran_7369e380_2K-2.webp`
- `apps/cms/media/Airplane_taking_off_from_Tehran_7369e380_2K-3.webp`
- `apps/cms/media/Airplane_taking_off_from_Tehran_7369e380_2K-4.webp`
- `apps/cms/media/Airplane_taking_off_from_Tehran_7369e380_2K.webp`
- `apps/cms/media/Animated_map_showing_route_3b4e6ea5_2K.webp`
- `apps/cms/media/Army_parade_in_Persepolis_a77b2bae_2K.webp`
- `apps/cms/media/Coronation_ceremony_royal_dais_f44ade5b_2K.webp`
- `apps/cms/media/logo-1.webp`
- `apps/cms/media/logo-2.webp`
- `apps/cms/media/logo.webp`
- `apps/cms/next-env.d.ts`
- `apps/cms/src/access/roles.ts`
- `apps/cms/src/collections/admins/admins.collection.ts`
- `apps/cms/src/collections/audit-logs/audit-logs.collection.ts`
- `apps/cms/src/collections/audit-logs/index.ts`
- `apps/cms/src/collections/audit-logs/log-action.ts`
- `apps/cms/src/collections/orders/_apply-reservation.before-change.ts`
- `apps/cms/src/collections/orders/_prepare-order.before-validate.ts`
- `apps/cms/src/collections/plans/plans.collection.ts`
- `apps/cms/src/collections/products/_sync-slug-and-dimensions.before-validate.ts`
- `apps/cms/src/collections/products/components/ProductPreview.tsx`
- `apps/cms/src/collections/products/products.collection.ts`
- `apps/cms/src/collections/users/users.collection.ts`
- `apps/cms/src/lib/sms.ts`
- `apps/cms/src/migrations/20261101_151430_update_plans_is_active.json`
- `apps/cms/src/migrations/20261101_151430_update_plans_is_active.ts`
- `apps/cms/src/migrations/20261104_082415_add_secondary_unit_to_products.json`
- `apps/cms/src/migrations/20261104_082415_add_secondary_unit_to_products.ts`
- `apps/cms/src/migrations/index.ts`
- `apps/cms/src/payload-types.ts`
- `apps/cms/src/payload.config.ts`
- `apps/cms/src/seed.ts`
- `apps/cms/tsconfig.tsbuildinfo`
- `apps/web/Dockerfile`
- `apps/web/index.html`
- `apps/web/src/components/layout/app-header.tsx`
- `apps/web/src/components/layout/mobile-bottom-nav.tsx`
- `apps/web/src/components/ui/icons.tsx`
- `apps/web/src/features/account/profile-view.tsx`
- `apps/web/src/features/auth/auth-store.ts`
- `apps/web/src/features/auth/login-card.tsx`
- `apps/web/src/features/checkout/cart-summary.tsx`
- `apps/web/src/features/checkout/pre-invoice-modal.tsx`
- `apps/web/src/features/orders/order-invoice-modal.tsx`
- `apps/web/src/features/orders/order-store.ts`
- `apps/web/src/features/plans/plan-card.tsx`
- `apps/web/src/features/plans/plan-modal.tsx`
- `apps/web/src/features/plans/plans-store.ts`
- `apps/web/src/features/products/filter-drawer.tsx`
- `apps/web/src/features/products/product-bottom-sheet.tsx`
- `apps/web/src/features/products/product-card.tsx`
- `apps/web/src/features/products/product-config-card.tsx`
- `apps/web/src/features/products/product-store.ts`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/useOrders.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/query-client.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/routes/__root.tsx`
- `apps/web/src/routes/cart.tsx`
- `apps/web/src/routes/orders/$id.tsx`
- `apps/web/src/routes/orders/index.tsx`
- `apps/web/src/routes/plans.tsx`
- `apps/web/src/routes/product/index.tsx`
- `apps/web/src/routes/product/new.tsx`
- `apps/web/src/styles/globals.css`
- `apps/web/src/types/order.ts`
- `apps/web/src/types/plan.ts`
- `apps/web/src/types/product.ts`
- `apps/web/vite.config.ts`
- `packages/contract/src/catalog.ts`
- `packages/contract/src/customer.ts`
- `packages/contract/src/order.ts`
- `packages/contract/src/plan.ts`
