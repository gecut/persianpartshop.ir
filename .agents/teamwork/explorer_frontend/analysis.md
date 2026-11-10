# گزارش جامع تحلیل فرانت‌اند، قراردادهای مشترک و کارایی کلاینت PersianPart 2.0
## Frontend, Shared Contracts & Client Performance Deep-Dive Audit

- **تاریخ تحلیل**: ۲۰۲۶-۱۱-۱۰ (10 November 2026)
- **محدوده بررسی**: `apps/web` (React 19, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, HeroUI v3) و `packages/contract` (oRPC v2, Zod v3)
- **سناریوی عملیاتی**: بار ترافیکی بالا با چندین هزار کاربر فعال همزمان (Several Thousand Concurrent Active Users) در بستر شبکه اینترنت موبایل و دسکتاپ ایران

---

## ۱. همروندی کلاینت و رفتار شبکه تحت بار بالا (Client-Side Concurrency & Network Impact)

### ۱.۱. پیکربندی حافظه موقت (TanStack Query Cache Configuration) و سناریوی طوفان بازخوانی (Refetch Storm)
در فایل `apps/web/src/lib/query-client.ts` (خطوط ۱۹ تا ۲۸):
```ts
defaultOptions: {
  mutations: { networkMode: 'always', retry: false },
  queries: {
    staleTime: 120_000,
    gcTime: 30 * 60_000,
    retry: (count, error) => { ... },
    refetchOnWindowFocus: true, // <-- خطر طوفان همزمان
  },
}
```
علاوه بر این در فایل `apps/web/src/app/use-session-sync.ts` (خطوط ۲۰ تا ۳۱):
```ts
const { data: sessionData, error: sessionError, refetch: refetchSession } = useQuery({
  queryKey: queryKeys.auth.session(user?.id),
  queryFn: async () => { ... return api.auth.session() },
  enabled: isAuthenticated && !isLoginPage,
  staleTime: 60_000,
  refetchOnWindowFocus: true,
  retry: false,
})
```
و در فایل `apps/web/src/modules/products/catalog-data.ts` (خطوط ۲۷ تا ۲۹):
```ts
window.addEventListener('online', () => void catalogCoordinator.resume())
window.addEventListener('focus', () => void catalogCoordinator.resume())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void catalogCoordinator.resume() })
```
و درون `catalogCoordinator.pump()` در فایل `apps/web/src/modules/products/catalog-coordinator.ts` (خطوط ۸۹ تا ۱۱۹):
```ts
if (snapshot().complete && !sweepStart) {
  if (!force && Date.now() - snapshot().completedAt < 120_000) return Promise.resolve()
  cursor = undefined; seen = new Set(); targeted.clear(); sweepStart = ++sequence
}
...
do {
  const read = ++sequence
  const page = await request(signal => transport.syncPage({ cursor, limit: !cursor && !snapshot().completedAt ? 24 : 100 }, signal))
  merge(page.items, page.scopeKey, read)
  ...
} while (expected === epoch && available(false) && !foreground)
```

#### تحلیل آسیب‌پذیری و بار عملیاتی:
1. **طوفان بازخوانی همگام در فوکوس پنجره (Thundering Herd on Window Focus)**: با تنظیم `refetchOnWindowFocus: true`، هرگاه کاربری در موبایل یا دسکتاپ بین تب‌ها جابجا شود یا مرورگر را باز کند، به محض گذشت ۲ دقیقه، کوئری‌های منقضی بلافاصله درخواست شبکه ارسال می‌کنند.
2. **پیمایش مجدد تمام کاتالوگ (Full Catalog Traversal via syncPage)**: طبق منطق `catalogCoordinator`، هر ۱۲۰ ثانیه یک‌بار با اولین فوکوس یا رویداد `visibilitychange`، کلاینت شروع به دریافت کامل تمام صفحات کاتالوگ در دسته‌های ۱۰۰ تایی می‌کند تا زمانی که `nextCursor` خالی شود. اگر کاتالوگ شامل ۱,۰۰۰ کالا باشد، هر کلاینت ۱۰ درخواست پشت سر هم ارسال می‌کند.
3. **تراکم روی سرور**: در سناریوی ۵,۰۰۰ کاربر همزمان، هر ۲ دقیقه تا ۵۰,۰۰۰ درخواست `syncPage` و ۵,۰۰۰ درخواست `auth.session` به سرور Bun/Hono و پایگاه‌داده PostgreSQL شلیک می‌شود که به راحتی می‌تواند منجر به Connection Pool Exhaustion و خطای 504 Gateway Timeout شود.

### ۱.۲. آبشارهای شبکه و واکشی‌های چندباره (Request Waterfalls & Duplicate API Calls)
1. **عدم مسدودسازی و موازی‌سازی کوئری‌های پیش‌نیاز**:
   - در بازسازی سفارش (`Reorder`) یا بارگذاری سبد خرید (`apps/web/src/modules/cart/cart-store.ts:33-35` و `apps/web/src/modules/orders/activity-feed/activity-feed.view.tsx:33`)، متد `useCatalogIds(ids)` فراخوانی می‌شود.
   - اگر کالاها در کش لوکال نباشند، هماهنگ‌کننده کاتالوگ کالاها را در دسته‌های ۱۰۰ تایی با `api.catalog.getByIds` واکشی می‌کند (`catalog-coordinator.ts:140-153`).
   - در صورت باز شدن صفحه جزئیات سفارش، همزمان `api.order.getById` فراخوانی می‌شود و سپس برای محاسبه مقادیر و تصاویر اقلام، دوباره هماهنگ‌کننده کاتالوگ درگیر می‌شود که یک آبشار (Waterfall) متوالی پدید می‌آورد.
2. **عدم ادغام یا بچینگ در سطح کامپوننت‌ها**:
   - در `apps/web/src/modules/products/product-list/product-list.view.tsx`، چندین کوئری و استور به طور همزمان بدون اشتراک‌گذاری داده فعال هستند: `useCatalogProduct(productId)`، `useProducts()`، `useCart()`، `useProductSelection()`.

### ۱.۳. به‌روزرسانی‌های خوش‌بینانه در برابر مغایرت سرور (Optimistic Updates vs Server Reconciliations)
1. **تخلیه کامل مظنه‌ها در تغییر مقدار (Quote Annihilation)**:
   - در فایل `apps/web/src/modules/products/selection-store.ts` (خطوط ۱۵۴ تا ۱۶۱):
     ```ts
     setQuantity: (id: unknown, amount: number) => {
       ...
       invalidateValidation()
       state = { ...state, selectedIds: [...new Set([...state.selectedIds, cleanId])], quantities: { ...state.quantities, [cleanId]: amount }, quotes: [], candidates: [], busy: false, error: null }
       persist(); emit()
       return Promise.resolve()
     }
     ```
   - به محض اینکه کاربر متراژ کالا را تغییر می‌دهد، `quotes` بلافاصله به آرایه خالی `[]` تبدیل می‌شود. در نتیجه، محاسبات قیمت و کارتن در سبد خرید به تقریب‌های ریاضی بدون تأیید سرور در کلاینت (`cart-store.ts:37-45` و `math.ts`) سقوط می‌کند.
2. **شرایط رقابتی و معلق ماندن پرامیس با استیت نامتقارن (Race Condition in Warehouse Resolution)**:
   - در متد `update()` در فایل `selection-store.ts` (خطوط ۱۰۴ و ۱۱۳):
     ```ts
     warehouse = await new Promise<DraftWarehouse | null>(resolve => { choose = resolve })
     ```
   - متغیر سراسری تک‌نسخه‌ای `let choose` در سطح ماژول نگه‌داری می‌شود. اگر کاربر در حین باز بودن پاپ‌آپ انتخاب انبار، مقدار کالای دیگری را دستکاری کند یا صفحه را تغییر دهد، `invalidateValidation()` فراخوانی شده و پرامیس قبلی بدون بازخورد رها می‌شود.
3. **نبود کنترل همروندی خوش‌بینانه مبتنی بر نسخه (Lack of Optimistic Concurrency Token)**:
   - هیچ توکن نسخه‌ای (e.g., Row Version, ETag) بین لحظه مشاهده موجودی و لحظه ارسال در `api.order.submit` ارسال نمی‌شود؛ در صورت کاهش همزمان موجودی توسط کاربر دیگر در شرایط ترافیک سنگین، خطا تا آخرین ثانیه در مرحله نهایی فاکتور ظاهر نمی‌شود.

---

## ۲. حجم بسته، تفکیک کد و عملکرد بارگذاری اولیه (Bundle Size, Code Splitting & Loading Performance)

### ۲.۱. تکه‌بندی بسته در Vite و فقدان تفکیک کد مسیرها (Vite Chunk Splitting & Route Lazy Loading)
بررسی فایل `apps/web/vite.config.ts` نشان می‌دهد که تنظیمات خروجی رول‌آپ کاملاً خالی است:
- هیچ بلاک `build.rollupOptions.output.manualChunks` تعریف نشده است.
- تمام مسیرها در فایل `apps/web/src/routes/*.tsx` (مانند `account.tsx`، `cart.tsx`، `orders/index.tsx`، `orders/$id.tsx`، `plans.tsx`، `product/index.tsx`) کامپوننت‌های View خود را به صورت استاتیک ایمپورت کرده‌اند:
  ```ts
  // routes/account.tsx
  import { AccountView } from '@/modules/account/account.view'
  export const Route = createFileRoute('/account')({ component: AccountView })
  ```
- در فایل جنریت‌شده `apps/web/src/routeTree.gen.ts`، تمام این ماژول‌ها مستقیماً در ریشه ایمپورت شده‌اند:
  ```ts
  import { Route as AccountRouteImport } from './routes/account'
  import { Route as CartRouteImport } from './routes/cart'
  import { Route as OrdersIndexRouteImport } from './routes/orders/index'
  ...
  ```

#### خروجی واقعی بیلد (`apps/web/dist/assets/`):
| نام فایل خروجی | حجم واقعی (بایت) | حجم تخمینی (کیلوبایت) | وضعیت و تحلیل |
| :--- | :--- | :--- | :--- |
| `index-CDWzr00B.js` | **۱,۴۹۲,۲۴۵ بایت** | **~۱.۴۹ مگابایت** | فایل جاوااسکریپت ورودی تک‌تکه (Monolithic Entry Chunk) بدون تقسیم کد مسیرها |
| `index-CXHiVsZ4.css` | **۵۱۷,۱۹۷ بایت** | **~۵۱۷ کیلوبایت** | استایل‌های CSS تجمیع شده شامل تمام کامپوننت‌های HeroUI |
| `zxing_reader-BCjuyud6.wasm` | **۹۴۶,۸۶۰ بایت** | **~۹۴۶ کیلوبایت** | موتور وب‌اسمبلی بارکدخوان ZXing |
| `Navy Spiral Emblem App Icon.png` | **۱,۲۶۳,۰۹۵ بایت** | **~۱.۲۶ مگابایت** | آیکون اپلیکیشن بسیار سنگین در پوشه public/dist |

**ارزیابی کارایی کلاینت**:
- در شبکه تلفن همراه ایران (ایرانسل، همراه اول، رایتل) با پینگ متوسط ۶۰ تا ۱۵۰ میلی‌ثانیه، بارگیری بیش از ۲ مگابایت JS و CSS خام، زمان First Contentful Paint (FCP) را به بیش از **۳.۵ ثانیه** و Time to Interactive (TTI) را به بیش از **۵.۵ ثانیه** می‌رساند.
- کاربری که صرفاً برای مشاهده یک محصول یا ورود به صفحه لاگین آمده، مجبور است کدهای اسکنر QR، صدور فاکتور، پروفایل، سفارش‌ها و طرح‌ها را دانلود و ارزیابی کند.

### ۲.۲. بار اضافی HeroUI v3 و Tailwind CSS v4
1. **ایمپورت سراسری استایل‌های کامپوننت‌ها**:
   - در فایل `apps/web/src/styles/globals.css` (خط ۲):
     ```css
     @import "tailwindcss";
     @import "@heroui/styles";
     ```
   - ایمپورت سراسری `@heroui/styles` باعث الحاق تمامی کلاس‌ها و انیمیشن‌های تمامی اجزای HeroUI به فایل CSS خروجی شده و حجم CSS را به بیش از نیم مگابایت (۵۱۷ کیلوبایت) رسانده است.
2. **وابستگی‌های زائد و استفاده‌نشده در `package.json`**:
   - وابستگی `ogl: ^1.0.11` (موتور رندرینگ ۳ بعدی WebGL) در `dependencies` تعریف شده ولی در هیچ‌یک از کدهای فرانت‌اند استفاده نشده است.
   - وابستگی `nuqs: ^2.10.2` به همراه آداپتور آن در `root-layout.view.tsx` لود شده، در حالی که TanStack Router خود سیستم تایپ‌سیف جستجوی قدرتمند (`validateSearch`) دارد. این کار باعث بارگذاری دو سیستم مدیریت URL State به صورت همزمان شده است.

### ۲.۳. لودینگ فونت‌ها و مسیر رندرینگ بحرانی (Critical Rendering Path)
1. **فقدان Preload فونت وزیرمتن در `index.html`**:
   - در فایل `apps/web/index.html`، هیچ تگ `<link rel="preload" href="..." as="font" type="font/woff2" crossorigin>` وجود ندارد.
   - فونت از طریق `import '@fontsource-variable/vazirmatn'` در `apps/web/src/main.tsx:1` لود می‌شود.
   - بنابراین مرورگر پس از دانلود و پارس کامل جاوااسکریپت ورودی و CSS (بیش از ۲ مگابایت)، تازه آدرس فایل `vazirmatn-arabic-wght-normal-Cafbb7Zc.woff2` (۴۶.۳ کیلوبایت) را کشف می‌کند. این امر موجب پدیده FOIT (پرش متن نامرئی) و تاخیر چشمگیر در رندر اولین متن فارسی می‌شود.

---

## ۳. معماری React 19، مالکیت وضعیت و رندرینگ مجدد (React 19 Architecture, State & Re-renders)

### ۳.۱. انضباط مدیریت وضعیت (Prop Drilling vs Contexts vs Module Stores)
- ساختار فرانت‌اند ترکیبی از سه الگوی ناهماهنگ است:
  1. استورهای تک‌نسخه‌ای خارجی مبتنی بر `useSyncExternalStore` (`selection-store.ts`, `supply-request-draft.ts`, `write-activity.ts`).
  2. مدیریت داده‌های سرور در کش TanStack Query (`query-client.ts`, `catalog-coordinator.ts`).
  3. وضعیت‌های محلی کامپوننت با `useState`.
- استورهای تک‌نسخه‌ای لوکال به دلیل قرارگیری در سطح ماژول (`let state = empty()`, `let owner = ''`)، با چرخه حیات کامپوننت‌های React و قابلیت‌های جدید React 19 (مانند Concurrent Rendering و Transitions) همخوانی کامل ندارند و تفکیک آنها در تست‌های ایزوله سخت است.

### ۳.۲. رندرهای زائد در کامپوننت‌های سنگین (Unnecessary Re-renders)
1. **اشتراک‌های زنجیره‌ای در `ProductListView` (`product-list.view.tsx:36-64`)**:
   - این کامپوننت همزمان به `useProducts()`، `useCart()`، `useProductSelection()` و `useAuth()` متصل است.
   - هر بار که مقداری در `selectionStore` تغییر کند، استور `emit()` می‌دهد. کامپوننت `ProductListView` مجدداً اجرا می‌شود، متد `items` سبد خرید دوباره بازسازی می‌شود، شیء `cartIdSet` از نو با `new Set()` ایجاد می‌شود، و کل درخت لیست مجازی رندر مجدد می‌شود.
2. **شکسته‌شدن مِموریزیشن در کارت کالا (`ProductCard` & `ProductThumbnail`)**:
   - در فایل `apps/web/src/modules/products/product-card.tsx` (خطوط ۱۸ تا ۲۴)، کامپوننت `ProductCard` با `React.memo` بسته‌بندی شده است.
   - اما در خط ۷۸:
     ```tsx
     <ProductThumbnail
       src={imgSrc}
       alt={product.name}
       onOpenBottomSheet={() => onOpenBottomSheet?.(product)} // <-- Arrow Function جدید در هر رندر!
     />
     ```
   - ارسال تابع ناشناس درون JSX باعث می‌شود که رفرنس تابع `onOpenBottomSheet` در هر بار رندر تغییر کرده و مِموریزیشن کامپوننت `ProductThumbnail` عملاً خنثی شود.
3. **وابستگی ناپایدار در `useProductVirtualizer` (`_use-product-virtualizer.ts:54-66`)**:
   - فراخوانی `const virtualItems = virtualizer.getVirtualItems()` در هر بار رندر یک آرایه جدید برمی‌گرداند.
   - این آرایه در آرایه وابستگی‌های `useEffect` خط ۶۶ قرار گرفته است:
     ```ts
     useEffect(() => { ... }, [virtualItems, visibleProducts.length, hasMore, products.length])
     ```
   - این موضوع باعث اجرای مکرر افکت در هر رویداد اسکرول و پردازش غیرضروری منطق صفحه بعد می‌شود.

### ۳.۳. نشت رویدادها، تایمرها و افکت‌های پاکسازی‌نشده (Event Listener & Timer Leaks)
1. **تایمر دائمی بررسی وضعیت تب‌ها در `apps/web/src/lib/write-activity.ts` (خط ۳۸)**:
   ```ts
   window.setInterval(() => { if (localCount + mutationCount) announce(); else refresh() }, 5_000)
   ```
   این تایمر هر ۵ ثانیه در تمام تب‌های باز بدون توقف اجرا شده و در هر بار اجرای `refresh()` تمام کلیدهای `localStorage` را اسکن و پارس JSON می‌کند (`lines 22-26`). این امر حتی در زمان بیکاری کاربر، مصرف باتری و CPU مداوم ایجاد می‌کند.
2. **جلوگیری سراسری از انتخاب متن در `apps/web/src/main.tsx` (خطوط ۱۳ تا ۲۷)**:
   ```ts
   document.addEventListener('selectstart', (e) => { ... e.preventDefault() })
   ```
   این رویداد به صورت سراسری مانع کپی کردن شماره پیگیری، شناسه سفارش یا کد کالا توسط مشتری می‌شود و به عنوان بدهی دسترسی‌پذیری (A11y Debt) تلقی می‌گردد.
3. **دیالوگ‌های مسدودکننده بومی مرورگر (Native Blocking Alert/Confirm)**:
   - در فایل‌های `api-client.ts:66`، `auth-store.ts:218`، `supply-request-draft.ts:44, 73` فراخوانی‌های مستقیم `alert()` و `window.confirm()` وجود دارد.
   - این فراخوانی‌ها رویدادهای لمسی PWA و چرخه اصلی JS را قفل کرده و در دستگاه‌های موبایل تجربه کاربری بسیار ضعیفی ارائه می‌دهند.

---

## ۴. انطباق معماری و بدهی‌های ساختاری در `apps/web` (Architectural Compliance & Code Debt)

### ۴.۱. ساختار ماژول‌ها بر اساس استاندارد `AGENTS.md`
- در سند قانون اساسی مخزن (`AGENTS.md`) بند ۵.۴ مشخص شده است:
  - پوشه `routes/` فقط برای سیم‌کشی (`createFileRoute`، `validateSearch`، `component`) است و نباید منطق کسب‌وکار یا لودر سنگین داشته باشد.
  - در فایل `apps/web/src/routes/orders/$id.tsx` (خطوط ۵ تا ۷)، یک متد `loader` اینلاین قرار گرفته است.
- **نابسامانی مالکیت ماژول سبد خرید**:
  - فایل حیاتی `selection-store.ts` (مدیریت استیت انتخاب اقلام سبد خرید، اعتبارسنجی انبار، ساخت کلیدهای ارسال) به اشتباه در پوشه `apps/web/src/modules/products/` قرار گرفته است، در حالی که این ماژول هسته عملکردی `modules/cart/` است.
  - این جای‌گذاری نادرست سبب ایجاد وابستگی حلقوی مستقیم بین ماژول‌های `products`، `cart`، `auth` و `checkout` شده است:
    - `auth-store.ts` به `modules/products/selection-store.ts` وابستگی دارد.
    - `catalog-data.ts` به `modules/auth/auth-store.ts` وابستگی دارد.
    - `cart-store.ts` به هر دو ماژول فوق وابسته است.

### ۴.۲. فقدان مرزهای کنترل خطا (Complete Absence of Error Boundaries)
- **یافته بحرانی**: در سراسر پروژه `apps/web` (شامل `main.tsx`، `root-layout.view.tsx`، و روت‌های `routes/`) **هیچ کامپوننت `ErrorBoundary` یا متد `errorComponent` در روت‌ها تعریف نشده است**.
- در صورت بروز هرگونه خطای جاوااسکریپت در زمان رندر (Runtime Error) ناشی از داده‌های نامعتبر، فیلدهای `undefined`، شکست در فرمت‌بندی تاریخ یا عدم همخوانی ساختار محصول، کل درخت React 19 آن‌مانت شده و صفحه به صفحه سفید خاموش (White Screen of Death - WSOD) تبدیل می‌شود، بدون اینکه به کاربر دکمه تلاش مجدد، بازگشت به خانه، یا راهنمایی داده شود.

---

## ۵. قراردادها و اعتبارسنجی سرتاسری در `packages/contract` (Contract Integrity & Typesafety)

### ۵.۱. فرسایش ایمنی تیپ‌ها با استفاده گسترده از `z.any()`
در پکیج `packages/contract` که به عنوان **تک‌مرجع حقیقت (Single Source of Truth - SSOT)** سیستم معرفی شده، در بیش از **۴۰ اندپوینت** از خروجی‌های شل `z.any()` یا `.or(z.any())` استفاده شده است!

#### نمونه‌های مستند در کد:
1. **کاتالوگ (`packages/contract/src/catalog.ts`)**:
   - خط ۶۷۸: `.output(createPaginatedResponseSchema(CatalogProductSchema).or(z.object({ items: z.array(z.any()), total: z.number() })).or(z.any()))`
   - خط ۷۰۹: `}).or(CartonCalculationOutputSchema).or(z.any())`
   - خط ۷۲۰: `.output(z.array(CategorySchema).or(z.any()))`
   - خط ۷۲۵: `.output(z.array(BrandSchema).or(z.any()))`
   - خط ۷۳۰: `.output(z.array(TagSchema).or(z.any()))`
   - خط ۷۴۰ و ۷۵۱: `.output(z.any())`
2. **احراز هویت و کاربران (`packages/contract/src/auth.ts` و `customer.ts`)**:
   - خطوط ۴۱، ۶۰، ۷۲، ۱۰۱، ۱۱۵ در `auth.ts`: `user: z.any().optional()`, `.output(CustomerAuthResponseSchema.or(z.any()))`, `user: z.any().nullable()`
   - خطوط ۱۸۹، ۲۰۴، ۲۰۹، ۲۱۷، ۲۳۲، ۲۴۹، ۲۶۳، ۲۷۴ در `customer.ts`: `.output(CustomerProfileSchema.or(z.any()).nullable())`, `addresses: z.any().optional()`, `documents: z.array(z.any()).optional()`
3. **سفارش‌ها و خرید (`packages/contract/src/order.ts` و `shopping.ts`)**:
   - خط ۲۳۹، ۲۵۸، ۲۷۱، ۳۵۶ در `order.ts`: `.output(z.array(z.any()).or(createPaginatedResponseSchema(OrderSchema)).or(z.any()))`
   - تمامی اندپوینت‌های فایل `shopping.ts` (خطوط ۳۲، ۴۱، ۴۶، ۵۱، ۵۶، ۸۰، ۸۴، ۹۲، ۱۱۲) با خروجی `.output(z.any())` تعریف شده‌اند!

#### پیامدهای زنجیره‌ای این معضل:
- نوع برگشتی این پروسیجرها در کلاینت به `any` تبدیل می‌شود.
- در کلاینت فرانت‌اند (`apps/web`) توسعه‌دهنده ناچار شده برای جلوگیری از خطای کامپایلر، از کستینگ‌های متعدد `as any` و بررسی‌های دستی نوع شیء استفاده کند:
  - در `auth-store.ts:178`: `const userData = (res.user || (res as any).customer || {}) as any`
  - در `order-store.ts:14, 124, 145`: `mapDocToOrder(doc: any)`, `items.map((i: any) => ...)`
  - در `plans-store.ts:8`: `mapApiPlanToPlan(p: any)`
- هیچ اعتبارسنجی زمان اجرایی (Runtime Validation) در کلاینت انجام نمی‌شود؛ اگر ساختار داده از سمت پایگاه داده یا Payload CMS تغییر کند، خطای غیرمنتظره در عمق رندرینگ کامپوننت رخ می‌دهد.

### ۵.۲. تضاد مدل دامنه و کدهای مرده (Automotive Parts vs Ceramic Tiles)
- در فایل `packages/contract/src/catalog.ts` (خطوط ۱۶ تا ۲۷)، اسکیمای قطعات خودرو با فیلدهای `partNumber`، `vehicleBrand`، `vehicleModels`، `isOriginal` باقی مانده است (`PartSchema`).
- در حالی که تجارت واقعی سامانه پرشین‌پارت فروش عمده کاشی و سرامیک و مصالح ساختمانی با فیلدهای `width`, `height`, `sqmPerCarton`, `piecesPerCarton`, `grade`, `productType: 'tile' | 'other'` است.
- اسکیمای `PartSchema` یک کد مرده و باقیمانده از تمپلیت اولیه پروژه است که باعث سردرگمی توسعه‌دهندگان جدید می‌شود.

---

## ۶. انطباق راست‌به‌چپ (RTL) و بومی‌سازی فارسی (Persian Localization Audit)

### ۶.۱. کاربرد ویژگی‌های فیزیکی جهت‌دار در برابر ویژگی‌های منطقی
طبق سند قانون اساسی (`AGENTS.md`) و مهارت `rtl-persian-ui`، تمامی یو‌آی‌ها باید از کلاس‌های منطقی (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) به جای کلاس‌های فیزیکی (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`) استفاده کنند.

#### موارد نقض شده مشاهده شده در کد:
1. `apps/web/src/app/app-header.tsx:59`:
   - استفاده از `ml-1` به جای `ms-1` یا `me-1`. در جهت RTL، `ml-1` به سمت چپ (پایان) فاصله می‌دهد که معکوس رفتار مورد انتظار است.
2. استفاده گسترده از `text-right` و `text-left` به جای `text-start` و `text-end`:
   - `apps/web/src/components/feedback/toast.tsx:19`: `className="... text-right z-50"`
   - `apps/web/src/modules/account/profile-view/_profile-details-card.tsx:37`: `className="text-xs sm:text-sm text-right ..."`
   - `apps/web/src/modules/products/filter-drawer/_sort-filter.tsx:52, 56, 75, 81`: تکرار متعدد `text-right`.
   - `apps/web/src/modules/products/filter-drawer/_dimension-select.tsx:23, 47, 51, 70, 76, 91, 97`: تکرار متعدد `text-right`.
   - `apps/web/src/modules/orders/order-detail/_cancel-order-modal.tsx:85, 89, 110`: `text-right`.
   - `apps/web/src/modules/orders/order-invoice-modal/_invoice-items-table.tsx:29, 38, 41, 88, 91`: ترکیب درهم‌آمیخته `text-right` و `text-left` در سلول‌های جدول فاکتور.
   - `apps/web/src/modules/products/product-bottom-sheet/_product-stock-value.tsx:15, 21, 27`: `text-right`.

### ۶.۲. واحد پول تومان و ارقام فارسی در محاسبات
- در فایل `apps/web/src/lib/utils/currency.ts` (خطوط ۲۶ تا ۲۹):
  ```ts
  export function formatToman(value: number): string {
    return `${toPersianDigits(formatNumber(value))}`
  }
  ```
  تابع `formatToman` فقط ارقام را فارسی می‌کند و عبارت واحد «تومان» را اضافه نمی‌کند. این امر سبب شده تا کامپوننت‌های مختلف هر کدام به شیوه سلیقه‌ای واحد پول را الصاق کنند (برخی آیکون `TomanIcon`، برخی متن «تومان»، برخی پسوند «ت» یا خالی).
- در تابع `formatSquareMeters` در خطوط ۳۴ تا ۳۷:
  ```ts
  export function formatSquareMeters(value: number): string {
    const rounded = Math.round(value * 100) / 100
    return toPersianDigits(rounded.toFixed(rounded % 1 === 0 ? 0 : 2))
  }
  ```
  تابع `toFixed()` ممیز انگلیسی (`.`) تولید می‌کند و `toPersianDigits` صرفاً کاراکترهای عددی ۰-۹ را جایگزین می‌کند. در نتیجه خروجی به صورت `۳۵.۲` (با نقطه انگلیسی) رندر می‌شود، در حالی که در خط فارسی استاندارد باید از ممیز فارسی (`٫` - U+066B) یا فرمت‌کننده استاندارد `Intl.NumberFormat('fa-IR')` استفاده شود.

### ۶.۳. نیم‌فاصله (ZWNJ) و یکدستی متون
- ناهماهنگی در بکارگیری نیم‌فاصله: در فایل `pwa-controls.tsx:75` عبارت `بروزرسانی پرشین‌پارت` (بدون نیم‌فاصله و بدون «به‌») استفاده شده در حالی که در فایل `profile-view.tsx:93` عبارت `به‌روزرسانی` با نیم‌فاصله نوشته شده است.
- در `apps/web/src/lib/utils/date.ts` خطوط ۴۸ و ۶۶: اعتبارسنجی اینکه آیا تاریخ از قبل شمسی است با شرط شکننده `date.startsWith('۱۴') || date.startsWith('14')` انجام می‌شود که در صورت ارائه هر رشته دیگر ممکن است با خطای پردازش تاریخ مواجه شود.

---

## ۷. فهرست جامع بدهی‌های فنی و موازنه‌ها (Technical Debt & Trade-off Catalogue)

| ردیف | عنوان بدهی فنی / موازنه | سطح اهمیت (Severity) | مسیر فایل و شماره خطوط | اثرات عملیاتی و کاربری (Operational / User Impact) | راهکار پیشنهادی اصلاح (Remediation) |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **FD-01** | فقدان کامل Error Boundary در سطح ریشه و روت‌ها | **High** | `apps/web/src/main.tsx:47-52`, `apps/web/src/routes/__root.tsx:5-8` | بروز کوچکترین خطای زمان اجرا در کامپوننت‌ها منجر به سفید شدن کامل صفحه (WSOD) و قفل شدن کاربر می‌شود. | پیاده‌سازی یک `RootErrorBoundary` با UI فارسی، پیام دوستانه، دکمه «تلاش دوباره» و پاکسازی استیت؛ افزودن `errorComponent` به `createRootRoute`. |
| **FD-02** | حجم عظیم باندل ورودی (1.49MB JS + 517KB CSS) و عدم Lazy Load روت‌ها | **High** | `apps/web/src/routes/*.tsx`, `apps/web/vite.config.ts:73-146` | زمان بارگذاری اولیه بیش از ۵ ثانیه در شبکه موبایل ایران؛ هدررفت پهنای باند و مصرف شدید باتری گوشی کاربران. | انتقال مسیرها به `.lazy.tsx` در TanStack Router؛ پیکربندی `manualChunks` در Vite برای تفکیک هسته React، HeroUI، آیکون‌ها و ابزارهای بزرگ. |
| **FD-03** | طوفان درخواست‌های مکرر کاتالوگ و سشن در فوکوس پنجره (Refetch Storm) | **High** | `apps/web/src/lib/query-client.ts:26`, `apps/web/src/modules/products/catalog-coordinator.ts:89-119`, `apps/web/src/app/use-session-sync.ts:28-29` | با ۵,۰۰۰ کاربر همزمان، هر جابجایی تب ده‌ها هزار درخواست `syncPage` و `auth.session` متوالی به سرور ارسال کرده و سرور را دچار قطعی می‌کند. | غیرفعال‌سازی `refetchOnWindowFocus` سراسری در کوئری کلاینت؛ افزایش زمان کش؛ جایگزینی سنک ترتیبی ۱۰۰ تایی با مکانیزم وب‌سوکت یا کش محلی IndexedDB با هش تغییرات. |
| **FD-04** | فرسایش نوع‌بندی و تک‌مرجعیت حقیقت با استفاده فراگیر از `z.any()` در قراردادها | **High** | `packages/contract/src/catalog.ts:678,709,720...`, `packages/contract/src/shopping.ts`, `packages/contract/src/auth.ts:41,60...`, `packages/contract/src/order.ts:239,258...` | حذف مزیت تایپ‌سیفتی oRPC؛ ورود داده‌های نامعتبر از CMS به کلاینت بدون اعتبارسنجی؛ پر شدن فرانت‌اند از کست‌های ناامن `as any`. | پالایش کامل `packages/contract`؛ حذف پسوندهای `.or(z.any())` و بازنویسی دقیق اسکیمای Zod متناسب با مدل داده واقعی CMS و API. |
| **FD-05** | نشت تایمر دائمی و اسکن مداوم LocalStorage در تمام تب‌ها | **Medium** | `apps/web/src/lib/write-activity.ts:38` | اجرای تایمر ۵ ثانیه‌ای مداوم با حلقه `for` روی تمامی کلیدهای LocalStorage و `JSON.parse` در پس‌زمینه تب‌های بیکار؛ مصرف مداوم CPU. | جایگزینی تایمر دوره‌ای با رویدادهای واکنشی مبتنی بر BroadcastChannel و رویدادهای واقعی چرخه ثبت سفارش؛ توقف تایمر در تب‌های پس‌زمینه. |
| **FD-06** | تخلیه ناگهانی مظنه‌ها و افت به تخمین‌های محلی کلاینت در تغییر متراژ | **Medium** | `apps/web/src/modules/products/selection-store.ts:159`, `apps/web/src/modules/cart/cart-store.ts:37-45` | با تایپ کاربر در اینپوت متراژ، قیمت و کارتن تا زمان اعتبارسنجی مجدد نامعتبر شده و ممکن است مغایرت قیمتی به کاربر نمایش داده شود. | نگه‌داری آخرین مظنه معتبر برای هر قلم تا زمان دریافت پاسخ جدید به جای خالی کردن کل آرایه `quotes: []`؛ نمایش وضعیت لودینگ ظریف روی قلم در حال محاسبه. |
| **FD-07** | اختلال در رندرینگ با بسته‌شدن پرامیس معلق انتخاب انبار در استیت سراسری | **Medium** | `apps/web/src/modules/products/selection-store.ts:104,113` | متغیر سراسری ماژول `choose` در صورت ناوبری یا تداخل کاربر با کالای دیگر معلق مانده و باعث از دست رفتن انتخاب انبار می‌شود. | بازنویسی جریان انتخاب انبار در قالب یک State Machine منسجم و شفاف یا یک مدال صریح در لایه UI، بدون بلاک کردن پرامیس‌های میانی در حافظه ماژول. |
| **FD-08** | ناهماهنگی‌های RTL و استفاده از کلاس‌های فیزیکی (`ml-1`, `text-right`) | **Medium** | `apps/web/src/app/app-header.tsx:59`, `apps/web/src/modules/account/profile-view/_profile-details-card.tsx:37`, `apps/web/src/components/feedback/toast.tsx:19` | فاصله نادرست دکمه‌ها در حالت RTL و تراز نامناسب متون در نمایشگرهای مختلف. | تبدیل تمامی `ml-` به `ms-` و تبدیل کلاس‌های `text-right` به کلاس منطقی `text-start`. |
| **FD-09** | مسدودسازی هماهنگ رویدادها با دیالوگ‌های بومی `alert()` و `confirm()` | **Medium** | `apps/web/src/lib/api-client.ts:66`, `apps/web/src/modules/auth/auth-store.ts:218`, `apps/web/src/modules/supply-requests/supply-request-draft.ts:44,73` | فریز شدن تِرد جاوااسکریپت، رفتار ناسازگار در وب‌ویو و PWA در اندروید/iOS؛ ظاهر زشت و ناهماهنگ با دیزاین سیستم. | جایگزینی تمام `window.confirm` و `alert` با کامپوننت `Modal` یا `ConfirmDialog` هماهنگ با HeroUI v3. |
| **FD-10** | غیرفعال‌سازی سراسری قابلیت سلکت متن در مرورگر | **Low** | `apps/web/src/main.tsx:13-27`, `apps/web/src/styles/globals.css:247-250` | کاربر قادر به کپی کردن کدهای فنی، نام کالا یا متن‌ها نیست؛ آسیب به قابلیت استفاده و دسترسی‌پذیری. | حذف رویداد سراسری `selectstart` و محدود کردن `user-select: none` صرفاً به دکمه‌ها، آیکون‌ها و تب‌ها. |
| **FD-11** | فقدان Preload فونت وزیرمتن در `index.html` | **Low** | `apps/web/index.html:1-22`, `apps/web/src/main.tsx:1` | تاخیر در نمایش متن اولیه فارسی (FOIT/FOUT) تا زمان بارگیری ۲ مگابایت JS و CSS. | افزودن تگ `<link rel="preload" href="/assets/...woff2" as="font" type="font/woff2" crossorigin>` در هدر HTML. |
| **FD-12** | ممیز انگلیسی در نمایش مقادیر اعشاری متراژ | **Low** | `apps/web/src/lib/utils/currency.ts:34-37` | نمایش مقادیر به صورت `۳۵.۲` به جای `۳۵٫۲` استاندارد فارسی. | استفاده از کاراکتر ممیز فارسی `٫` یا `Intl.NumberFormat('fa-IR')` با تنظیمات اعشار مناسب. |
| **FD-13** | کدهای مرده و ناهماهنگی دامنه قطعات خودرو (`PartSchema`) در کاتالوگ | **Low** | `packages/contract/src/catalog.ts:16-27` | وجود اسکیماهای فروش قطعات یدکی خودرو در پروژه‌ای که حوزه فعالیت آن فروش کاشی و سرامیک ساختمانی است. | حذف کامل `PartSchema` و کدهای بی‌استفاده مرتبط از پکیج قراردادها. |
| **FD-14** | وابستگی اضافه `ogl` در پکیج وب | **Low** | `apps/web/package.json:27` | وجود پکیج سنگین WebGL که در هیچ‌جای پروژه ایمپورت یا استفاده نشده است. | حذف `ogl` از فایل `package.json` و اجرای `pnpm install`. |

---

## ۸. خلاصه و نتیجه‌گیری اجرایی (Executive Summary)
بررسی جامع بخش‌های فرانت‌اند (`apps/web`) و قراردادهای مشترک (`packages/contract`) نشان داد که ساختار پایه‌ای با ترکیب ابزارهای مدرن (React 19, TanStack Router, TanStack Query, HeroUI v3, Tailwind v4, oRPC) پایه‌ریزی شده، اما برای ورود به فاز تولید با چندین هزار کاربر همزمان با چالش‌های گلوگاهی شدیدی مواجه است:
1. **خطر فروپاشی سرور با رفتار کلاینت**: کلاینت به دلیل بازخوانی‌های بی‌محابای `catalogCoordinator` و تنظیم `refetchOnWindowFocus: true` به عنوان یک عامل فشار غیرعادی روی API عمل خواهد کرد.
2. **پایداری شکننده کلاینت**: عدم وجود حتی یک `ErrorBoundary` در کل سیستم به معنی آسیب‌پذیری بحرانی در برابر خطاهای کوچک زمان اجراست.
3. **افت تجربه کاربری با باندل بیش از ۲ مگابایتی**: عدم تفکیک کد مسیرها در شبکه موبایل کشور لود اولیه‌ای سنگین و کند ایجاد می‌نماید.
4. **تخریب قرارداد ایمن**: وجود `z.any()` در خروجی اندپوینت‌ها قراردادهای تایپ‌اسکریپت را بی‌اعتبار کرده است.

اصلاح موارد جدول بدهی‌های فنی بالا در فازهای مهندسی بعدی، تضمین‌کننده عملکرد روان، سریع و فوق‌العاده پایدار پرشین‌پارت در مقیاس‌های ترافیکی گسترده خواهد بود.
