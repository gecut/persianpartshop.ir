# گزارش جامع ارزیابی معماری بک‌اند، همزمانی بالا و بدهی‌های فنی (PersianPart 2.0)

> **دامنه ارزیابی**: `apps/api` (Hono + oRPC بر بستر Bun)، `apps/cms` (Payload CMS v3 بر بستر Next.js و PostgreSQL)، قراردادهای مرتبط در `packages/contract`، پیکربندی استقرار کانتینری (`docker-compose.yml`, `Dockerfile`ها)  
> **فرض عملیاتی مبنا**: چندین هزار کاربر فعال همزمان (High Concurrency Peak Load در ساعات پرتردد یا کمپین‌های فروش تجاری B2B)  
> **وضعیت کاوش**: کاملاً Read-Only، مستند به ردیابی دقیق خطوط کد، توابع و الگوهای اجرایی.

---

## ۱. معماری پایگاه داده، مدیریت همزمانی و قفل‌ها (Database Architecture & Concurrency)

### ۱.۱. پیکربندی استخر اتصالات پایگاه داده (PostgreSQL Connection Pool Sizing & Lifecycle)
- **مشاهده در کد**: در فایل `apps/cms/src/payload.config.ts` (خطوط ۱۴۷ تا ۱۵۴):
  ```typescript
  db: databaseUrl.startsWith('postgres')
    ? postgresAdapter({
        pool: {
          connectionString: databaseUrl,
        },
        push: false,
        prodMigrations: migrations,
      })
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  آداپتور PostgreSQL پیلود (`@payloadcms/db-postgres`) به‌صورت پیش‌فرض از پکیج `pg` استفاده می‌کند. شیء `pool` تعریف‌شده در تنظیمات بالا، هیچ‌گونه پارامتر حیاتی مقیاس‌پذیری اعم از `max`، `min`، `idleTimeoutMillis`، `connectionTimeoutMillis`، `maxUses` یا تنظیمات KeepAlive را مشخص نکرده است.
  در غیاب مقداردهی صریح، پکیج `node-postgres` مقدار پیش‌فرض **۱۰ اتصال (max: 10)** را در نظر می‌گیرد.
  در سناریوی چندین هزار کاربر فعال همزمان، تنها ۱۰ کوئری یا تراکنش می‌توانند همزمان به PostgreSQL وصل شوند. باقی درخواست‌ها در صف انتظار صف‌آرایی می‌کنند.
  چون `connectionTimeoutMillis` نیز تنظیم نشده است (پیش‌فرض ۰ به معنای انتظار نامحدود)، با انباشت صدها درخواست در زمان اوج، اتصال‌ها قفل شده و به شکل آبشاری منجر به انباشت حافظه در Node.js و بروز خطاهای `504 Gateway Timeout` در لایه Nginx/Caddy می‌گردد.

### ۱.۲. معماری هاپ دوگانه و غیبت دسترسی مستقیم API به دیتابیس (Dual-Process Hop & Decorative Dependency)
- **مشاهده در کد**: در `apps/api/package.json` خط ۴۰، پکیج `"pg": "^8.23.1"` نصب شده است، اما با جستجوی سراسری در دایرکتوری `apps/api/src/`، این پکیج در هیچ کلاسی وارد (Import) نشده است.
  برعکس، در `apps/api/src/payload.ts` و تمام روترها (`catalog.ts`, `shopping.ts`, `order.ts`, `warehouse.ts`)، ارتباط با داده‌ها منحصراً از طریق کلاینت HTTP تحت عنوان `sdk` (`@payloadcms/sdk`) انجام می‌گیرد:
  ```typescript
  // apps/cms/src/sdk.ts:57
  return 'http://localhost:5174/api'
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  هر درخواستی که از سمت کلاینت وب یا موبایل به `apps/api` (Hono روی Bun) می‌رسد، مستقیماً به دیتابیس وصل نمی‌شود؛ بلکه یک درخواست HTTP داخلی روی پورت `5174` به اپلیکیشن CMS (روی Next.js) ارسال می‌کند. اپلیکیشن Next.js درخواست REST را اعتبارسنجی کرده، هوک‌ها را اجرا نموده و از طریق استخر اتصالات خود به PostgreSQL وصل می‌شود؛ سپس خروجی را JSON Serialize کرده و به Bun بازمی‌گرداند تا Bun مجدداً آن را Parse و از طریق oRPC به کاربر پاسخ دهد.
  **پیامدهای فاجعه‌بار این الگو در همزمانی بالا**:
  1. دو برابر شدن Latency هر درخواست (یک رفت و برگشت شبکه محلی/سوکت میان Bun و Next.js + یک کوئری به دیتابیس).
  2. ایجاد گلوگاه گلوگاه روی وب‌سرور Next.js که اساساً برای پنل ادمین طراحی شده و برای پردازش هزاران RPS ترافیک مشتریان بهینه‌سازی نشده است.
  3. مصرف حافظه و CPU مضاعف ناشی از تبدیل مکرر اشیاء جاوااسکریپت به JSON و برعکس.

### ۱.۳. تراکنش‌ها، سطوح ایزولاسیون و رقابت قفل‌ها (Transactions & Lock Contention)
- **مشاهده در کد**:
  - `apps/cms/src/collections/orders/_lock-order.before-operation.ts` (خطوط ۵ تا ۱۳):
    ```typescript
    const transaction = await getOrderTransaction(req)
    await transaction.execute(sql`SELECT "id" FROM "orders" WHERE "id" = ${id} FOR UPDATE`)
    ```
  - `apps/cms/src/collections/orders/_prepare-order.before-validate.ts` (خطوط ۲۲ و ۱۳۹):
    ```typescript
    const lockedWarehouse = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'exact' FOR SHARE`)
    ...
    for (const [productId, requestedArea] of [...consolidatedMap.entries()].sort(([a], [b]) => a - b)) {
      await db.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR SHARE`)
      ...
    ```
  - `apps/cms/src/collections/warehouse-stock/_stock-operations.ts` (خطوط ۳۴ تا ۴۸):
    ```typescript
    for (const item of items) {
      const result = await db.execute(sql`
        UPDATE warehouse_stock SET inventory_sqm = inventory_sqm - ${item.deliverableArea}, revision = revision + 1, updated_at = NOW()
        WHERE warehouse_id = ${warehouseId} AND product_id = ${item.productId} AND inventory_sqm >= ${item.deliverableArea}
        RETURNING id
      `)
      if (result.rows.length !== 1) throw new Error('موجودی انبار برای تأمین سفارش کافی نیست.')
    }
    ```
- **تحلیل فنی و رفتار در بار همزمان**:
  - **نقاط قوت طراحی**: مرتب‌سازی اقلام بر اساس شناسه محصول (`.sort(([a], [b]) => a - b)`) مانع از بروز بن‌بست چرخه قفل (Deadlock) میان تراکنش‌های همزمان ثبت سفارش اقلام مشترک می‌شود.
  - **گلوگاه‌های شدید همزمانی**:
    1. سطح ایزولاسیون صراحتاً تعیین نشده و تابع پیش‌فرض PostgreSQL یعنی `READ COMMITTED` است.
    2. فرآیند ثبت سفارش در `prepareOrderBeforeValidate` دارای یک آبشار طولانی از فراخوانی‌های ترتیبی در داخل تراکنش باز است:
       - قفل `FOR SHARE` روی انبار
       - استعلام دیتابیسی کاربر
       - استعلام تک‌تک محصولات به شکل ترتیبی و اخذ قفل `FOR SHARE` روی جدول `products`
       - اعمال محاسبات متراژ و قیمت
       - به‌روزرسانی تک‌تک رکوردهای `warehouse_stock` با قفل ردیفی انحصاری ناشی از `UPDATE`
       - درج در جداول `orders` و رکوردهای آرایه‌ای `orders_items`.
    3. چون استخر دیتابیس تنها ۱۰ اتصال دارد، اگر فقط ۱۰ مشتری در یک لحظه دکمه ثبت سفارش را بزنند، تمام ۱۰ اتصال دیتابیس درگیر تراکنش‌های چندمرحله‌ای طولانی خواهند شد و تمام عملیات‌های دیگر سیستم (لاگین، مرور کاتالوگ و استعلام قیمت) به حالت تعلیق کامل درمی‌آیند.

### ۱.۴. شرایط مسابقه در تغییر آدرس کاربر (Lost Update Race Condition in Mutate Address)
- **مشاهده در کد**: در فایل `apps/api/src/routers/shopping.ts` (خطوط ۴۴ تا ۷۰):
  ```typescript
  const mutateAddress = authed.shopping.mutateAddress.handler(async ({ input, context }) => {
    const userDoc: any = await sdk.findByID({ collection: 'users', id: context.user.id })
    const currentAddresses: any[] = userDoc?.addresses || []
    ...
    const updatedUser: any = await sdk.update({
      collection: 'users',
      id: context.user.id,
      data: {
        addresses: updatedAddresses,
      },
    })
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  این متد کاملاً فاقد قفل خوش‌بینانه (Optimistic Concurrency Control)، نسخه ردیف (Revision Check) یا تراکنش اتمیک است. اگر کاربری دو تب باز داشته باشد یا با دو دستگاه همزمان آدرس جدیدی اضافه کند، درخواست دوم با خواندن وضعیت قدیمی، آدرس ثبت‌شده توسط درخواست اول را به کلی بازنویسی و پاک می‌کند (Lost Update).

### ۱.۵. فاجعه قفل‌های طولانی در ورود دسته‌ای اکسل/CSV (Batch Import Monopoly)
- **مشاهده در کد**: در `apps/cms/src/collections/warehouse-stock/_import.endpoints.ts` (خطوط ۶۶ تا ۷۸):
  ```typescript
  for (const row of [...snapshot.rows].sort((a, b) => a.productId - b.productId)) {
    const product = await db.execute(sql`SELECT updated_at FROM products WHERE id = ${row.productId} FOR UPDATE`)
    ...
    if (row.basePricePerSqm !== undefined && row.basePricePerSqm !== row.previousPrice) {
      await req.payload.update({ collection: 'products', id: row.productId, data: { basePricePerSqm: row.basePricePerSqm }, req, overrideAccess: false })
    }
    if (row.inventorySqm !== undefined && snapshot.warehouseId) {
      ... await replaceWarehouseStock(req, snapshot.warehouseId, row.productId, row.inventorySqm, row.revision)
    }
  }
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  اگر مدیر انبار یک فایل حاوی ۵٬۰۰۰ ردیف محصول را برای بروزرسانی قیمت یا موجودی اعمال کند، این حلقه تک‌تک ۵٬۰۰۰ محصول را با `SELECT ... FOR UPDATE` قفل کرده و داخل **یک تراکنش تکی و یکپارچه** با متد سنگین `req.payload.update` به‌روزرسانی می‌کند.
  این تراکنش ممکن است چندین دقیقه زمان ببرد. در طول این مدت:
  1. هزاران کاربر همزمان که در حال مرور کاتالوگ یا ثبت سفارش هستند، به دلیل قفل انحصاری ردیف‌های کالا یا اتمام اتصالات استخر دیتابیس متوقف و با خطای Timeout مواجه می‌شوند.
  2. کل پایگاه داده در طول عملیات Import فلج می‌شود.

### ۱.۶. الگوهای N+1 و کوئری‌های ناکارآمد کاتالوگ (N+1 & Memory Aggregations)
1. **فیلتر ابعاد در حافظه جاوااسکریپت (In-Memory Faceting)**:
   در فایل `apps/api/src/routers/catalog.ts` (خطوط ۱۷۹ تا ۲۰۶):
   ```typescript
   async function catalogDimensions(input: { onlyActive?: boolean } | undefined, context: Context) {
     ...
     let page = 1
     while (true) {
       const result = await sdk.find({
         collection: 'products', where, select: { dimension: true }, depth: 0,
         limit: 500, page, sort: 'id',
       })
       for (const product of result.docs) {
         const id = typeof product.dimension === 'object' ? product.dimension?.id : product.dimension
         if (id != null) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1)
       }
       if (!result.hasNextPage) break
       page += 1
     }
     return docs.sort((a, b) => (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0))
   }
   ```
   **تحلیل**: برای نمایش فیلتر ابعاد در نوار کناری فرانت‌اند، سرور API از طریق حلقه `while(true)` تمام رکوردهای جدول محصولات را در دسته‌های ۵۰۰ تایی واکشی کرده و در حافظه رم شمارش می‌کند! اگر ۱۰٬۰۰۰ کالا وجود داشته باشد، ۲۰ درخواست HTTP متوالی به CMS ارسال می‌شود تا فقط تعداد کالاهای هر بعد را بشمارد! این عملیات با یک کوئری ساده SQL به شکل `SELECT dimension_id, COUNT(*) FROM products GROUP BY dimension_id` با چند میلی‌ثانیه زمان قابل انجام بود. با هزار کاربر فعال، این تابع سرور را دچار OOM (Out of Memory) و مرگ پروسه می‌کند.

2. **حلقه‌های تودرتوی استعلام موجودی انبار**:
   در `apps/api/src/routers/warehouse.ts` (خطوط ۳۵ تا ۶۱) در تابع `availability`:
   یک حلقه `while(true)` برای پیمایش انبارها و داخل آن یک حلقه `while` دیگر برای استعلام دسته‌های ۱۰۰۰ تایی `warehouse-stock` قرار دارد. این یعنی به ازای هر بار مشاهده سبد خرید یا اعتبارسنجی قیمت توسط کاربر، دهها فراخوانی متوالی HTTP به CMS صورت می‌گیرد.

3. **تزریق موجودی ترتیبی در کاتالوگ**:
   در `apps/api/src/routers/warehouse-stock.helpers.ts` (خطوط ۱۱ تا ۳۱) تابع `attachWarehouseStock` شامل دو حلقه `while(true)` با فراخوانی‌های صفحه‌بندی‌شده است که روی تک‌تک درخواست‌های مرور کاتالوگ اجرا می‌گردد.

4. **جستجوی متنی پرهزینه فاقد ایندکس (Full Table Scan with Multi-Column LIKE)**:
   در `apps/cms/src/endpoints/catalog-browse.endpoint.ts` (خط ۲۷):
   ```sql
   (lower(p.name) LIKE $pattern OR lower(p.sku) LIKE $pattern OR lower(COALESCE(b.name,'پرشین پارت')) LIKE $pattern OR lower(COALESCE(p.color,'استاندارد')) LIKE $pattern OR lower(CASE ...) LIKE $pattern OR EXISTS (SELECT 1 FROM products_rels r JOIN tags t ON t.id=r.tags_id WHERE r.parent_id=p.id AND r.path='tags' AND lower(t.name) LIKE $pattern))
   ```
   استفاده از الگوی `%search%` بر روی ۵ فیلد با عبارات محاسباتی و زیرکوئری همبسته `EXISTS` روی برچسب‌ها، موتور دیتابیس را وادار به اسکن کامل جدول (Seq Scan) برای تک‌تک درخواست‌های جستجو می‌کند. در همزمانی بالا، CPU دیتابیس بر روی ۱۰۰٪ قفل می‌شود.

---

## ۲. وضعیت کشینگ و مدیریت نشست‌ها (Caching & State Management)

### ۲.۱. غیبت کامل لایه کش توزیع‌شده (Zero Distributed Caching Architecture)
- **مشاهده در کد**: در هیچ‌کدام از پکیج‌های `apps/api` و `apps/cms` اثری از کلاینت‌های کش نظیر `ioredis`، `redis`، `keyv` یا سیستم‌های مشابه دیده نمی‌شود. فایل `docker-compose.yml` نیز هیچ سرویس Redis یا KeyDB را راه‌اندازی نمی‌کند.
- **تحلیل فنی و رفتار در بار همزمان**:
  کاتالوگ محصولات، دسته‌بندی‌ها، مشخصات فنی، برندها و تنظیمات کاربر ماهیت خواندنی سنگین (Read-Heavy) دارند.
  در غیاب لایه کش:
  1. ۱۰۰٪ درخواست‌های خواندن مستقیماً به سمت Next.js و سپس PostgreSQL هدایت می‌شوند.
  2. با کوچک‌ترین Spike ترافیکی (نظیر ارسال پیامک همگانی یا کمپین تخفیف)، کل ترافیک هزاران کاربر مستقیماً به استخر ۱۰ اتصالی دیتابیس ضربه زده و سیستم بلافاصله دچار **Thundering Herd** و از دسترس خارج شدن می‌گردد.

### ۲.۲. ذخیره‌سازی توکن‌های باطل‌شده در حافظه محلی پردازه (In-Memory Blacklist Invalidation Failure)
- **مشاهده در کد**: در فایل `apps/api/src/lib/jwt.ts` (خطوط ۱۰۴ تا ۱۲۳):
  ```typescript
  // In-memory revocation store with expiration timestamp (in seconds)
  const revokedTokens = new Map<string, number>()
  
  export function revokeToken(token: string, expiresAt?: number): void {
    ...
    revokedTokens.set(token, exp)
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  مدیریت خروج از حساب (Logout) و باطل‌سازی نشست کاربر از طریق یک `Map` در حافظه رم پروسه Bun انجام می‌گیرد.
  1. **شکست در مقیاس‌بندی افقی (Horizontal Scaling Broken)**: اگر برای پاسخگویی به بار چند هزار کاربر، کانتینر API به ۳ کپی (Replicas) در کلاستر تبدیل شود، کاربری که در کانتینر ۱ دکمه خروج را می‌زند، توکنش در کانتینرهای ۲ و ۳ همچنان کاملاً معتبر است!
  2. **از دست رفتن با راه‌اندازی مجدد**: با هر بار ری‌استارت شدن پروسه API در داکر، این `Map` خالی شده و تمامی توکن‌های مشکوک یا ابطال‌شده پیشین تا ۳۰ روز آینده مجدداً معتبر می‌شوند!

### ۲.۳. طول عمر بیش از حد توکن‌های نشست و عدم استفاده از Refresh Token
- در `apps/api/src/lib/jwt.ts` خط ۲۲:
  ```typescript
  export const JWT_DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days
  ```
  توکن صادرشده برای کاربر ۳۰ روز اعتبار دارد و ساختار دوگانه Access Token (کوتاه‌مدت) و Refresh Token (بلندمدت) وجود ندارد. با توجه به ایراد بند ۲.۲ در ابطال نشست، اگر توکن کاربری نشت کند، دسترسی نامحدود به سیستم تا یک ماه برقرار است.

---

## ۳. زمان اجرای بون و اجرای ناهمگام (Bun Runtime & Async Execution)

### ۳.۱. فعال بودن میدلور Pretty JSON در محیط پروداکشن
- **مشاهده در کد**: در فایل `apps/api/src/server.ts` (خط ۳۸):
  ```typescript
  // Global Middlewares (Logger, Formatting, CORS)
  app.use('*', logger())
  app.use('*', prettyJSON())
  app.use(trimTrailingSlash())
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  میدلور `prettyJSON()` در فریم‌ورک Hono برای تمام درخواست‌ها پاسخ خروجی را با تورفتگی‌های چندخطی و فضاهای خالی فرمت‌بندی می‌کند (`JSON.stringify(data, null, 2)`).
  در پاسخ‌های چند مگابایتی کاتالوگ و با چند هزار کاربر همزمان، این کار:
  1. حجم پهنای باند شبکه مصرفی را ۳۰ تا ۵۰ درصد افزایش می‌دهد.
  2. پردازنده سرور (CPU Event Loop) را به‌شدت درگیر عملیات رشته‌سازی و تخصیص حافظه (String Concatenation & Memory Garbage Collection) می‌کند و توان گذردهی (Throughput) موتور Bun را نصف می‌کند.

### ۳.۲. مدل اجرایی تک‌پروسه‌ای و عدم پیکربندی کلاستر
- **مشاهده در کد**: در `apps/api/Dockerfile` (خط ۴۴):
  ```dockerfile
  CMD ["bun", "run", "apps/api/src/server.ts"]
  ```
  و در `docker-compose.yml` (خطوط ۵۴ تا ۵۶):
  ```yaml
  resources:
    limits:
      cpus: "1.0"
      memory: 1024M
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  پروسه Bun به‌صورت یک فرآیند واحد و تک‌رشته‌ای راه‌اندازی شده است. اگر سرور میزبان دارای ۸ یا ۱۶ هسته CPU باشد، موتور Bun تنها از ۱ هسته استفاده می‌کند و توان استفاده از دیگر هسته‌ها بدون استفاده از حالت چندپروسه‌ای (Bun Cluster یا هماهنگ‌کننده کانتینری نظیر Swarm/K8s) وجود ندارد. علاوه بر این، محدودیت سخت‌گیرانه `1.0 CPU` در داکر کامپوز، حداکثر سقف پردازش API را روی یک هسته محبوس کرده است.

---

## ۴. پردازش‌های ناهمگام و یکپارچه‌سازی‌های خارجی (Asynchronous Processing & External Integrations)

### ۴.۱. اجرای کاملاً همگام ارسال پیامک در چرخه درخواست HTTP کاربر
- **مشاهده در کد**: در فایل `apps/api/src/routers/auth.ts` (خطوط ۶۴ تا ۶۸):
  ```typescript
  try {
    await sendKavenegarOtp({
      receptor: phone,
      token: otpData.code,
      template: 'gcotp',
    })
  } catch (smsErr) {
    ...
  ```
  و در `apps/api/src/lib/kavenegar.ts` (خطوط ۷۲ تا ۷۹):
  ```typescript
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { ... },
    body: bodyParams.toString(),
  })
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  1. **فقدان تایم‌اوت**: متد `fetch` در `kavenegar.ts` هیچ‌گونه `AbortSignal` یا مهلت زمانی (Timeout) ندارد. اگر شبکه ارتباطی کشور یا سرورهای کاوه‌نگار با قطعی، کندی یا فیلترینگ موقت مواجه شوند، کانکشن‌های Bun تا بی‌نهایت باز می‌مانند.
  2. **مسدود شدن درخواست کلاینت**: کلاینت تا زمان پاسخ وب‌سرویس پیامک در انتظار می‌ماند. اگر زمان پاسخ پیامک ۳ ثانیه طول بکشد، کاربر ۳ ثانیه معطل شده و در ۱۰۰۰ درخواست همزمان، ۱۰۰۰ سوکت HTTP فعال روی سرور باقی می‌ماند.

### ۴.۲. فاجعه ارسال پیامک گروهی متوالی در هوک طرح‌های اختصاصی (Synchronous Batch SMS Blast in Hooks)
- **مشاهده در کد**: در `apps/cms/src/collections/plans/plans.collection.ts` (خطوط ۵۸ تا ۸۰):
  ```typescript
  if (newRecipientIds.length > 0) {
    for (const userId of newRecipientIds) {
      const userDoc: any = await req.payload.findByID({
        collection: "users",
        id: userId,
        depth: 0,
      });

      if (userDoc?.phone) {
        ...
        await sendSmsNotification({
          receptor: userDoc.phone,
          message: smsMessage,
        });
      }
    }
  }
  ```
  و در `apps/cms/src/lib/sms.ts` (خط ۱):
  ```typescript
  const SMS_TIMEOUT_MS = 5_000
  ```
- **تحلیل فنی و رفتار در بار همزمان**:
  هنگامی که مدیر فروش در پنل ادمین طرحی ایجاد کرده و آن را به ۵۰۰ مشتری تخصیص می‌دهد:
  سیستم در یک حلقه `for` ترتیبی، ۵۰۰ بار کوئری دیتابیس برای دریافت شماره تلفن می‌زند و ۵۰۰ بار به سرور کاوه‌نگار پیامک ارسال می‌کند!
  حتی در خوش‌بینانه‌ترین حالت (۲۰۰ میلی‌ثانیه برای هر پیامک)، ذخیره این فرم **۱۰۰ ثانیه** طول می‌کشد. در بدترین حالت با تایم‌اوت ۵ ثانیه‌ای، این فرآیند بیش از **۴۰ دقیقه** درخواست ذخیره ادمین را معلق نگه می‌دارد که قطعاً با تایم‌اوت مرورگر مواجه شده و پروسه در پس‌زمینه بدون ثبت وضعیت، ارتباطات را قفل می‌کند.

### ۴.۳. فقدان صف کارهای بادوام (No Durable Background Job Queue)
در هیچ کجای سامانه ابزارهایی نظیر `BullMQ`، `RabbitMQ` یا `Kafka` پیاده‌سازی نشده‌اند. تمامی اموری که باید در پس‌زمینه (Background Worker) انجام شوند (ارسال پیامک، ثبت لاگ‌های حسابرسی، ابطال کش، همگام‌سازی انبار) به شکل سنکرون در مسیر درخواست کلاینت اجرا می‌شوند.

### ۴.۴. ساختگی بودن کامل درگاه پرداخت (Dummy Payment Verification Stub)
- **مشاهده در کد**: در فایل `apps/api/src/routers/shopping.ts` (خطوط ۱۴۲ تا ۱۶۶):
  ```typescript
  const verifyPayment = authed.shopping.verifyPayment.handler(async ({ input, context, errors }) => {
    ...
    const orderDoc: any = await findOrderByIdOrNumber(input.orderId, 1)
    ...
    return {
      verified: true,
      message: 'سفارش معتبر و در حال پردازش است.',
      orderId: input.orderId,
    }
  })
  ```
- **تحلیل فنی**: هیچ‌گونه ارتباطی با درگاه‌های بانکی شاپرک (سداد، به‌پرداخت، سامان، زرین‌پال و ...) وجود ندارد. هر کاربری با فراخوانی متد `verifyPayment` با شناسه سفارش خود، بلافاصله وضعیت پرداخت را تأیید دریافت می‌کند. همچنین قرارداد در `packages/contract/src/shopping.ts:111` فاقد اعتبارسنجی بوده و به شکل `z.any()` رها شده است.

---

## ۵. تاب‌آوری، محدودسازی نرخ، امنیت و بازیابی پس از خرابی (Resiliency, Rate Limiting & Failover)

### ۵.۱. فقدان کامل محدودکننده نرخ درخواست (No Global or Modular Rate Limiting)
- در `apps/api/src/server.ts` هیچ نوع میان‌افزار محدودکننده نرخ (Rate Limiter) نظیر `hono-rate-limiter` یا ریت‌لیمیتینگ مبتنی بر Redis تعبیه نشده است.
- مسیرهای حساس مانند `/api/rpc/auth.requestOtp` (ارسال پیامک)، `/api/media/upload` (بارگذاری فایل) و کاتالوگ به راحتی می‌توانند هدف حملات DoS/DDoS یا تحمیل هزینه‌های سنگین پنل پیامکی (SMS Bombing) قرار گیرند.

### ۵.۲. آسیب‌پذیری بحرانی رقابت همزمان در شکستن کد OTP (OTP Brute-Force Race Condition)
- **مشاهده در کد**: در فایل `apps/api/src/lib/otp.ts` (خطوط ۱۱۳ تا ۱۷۲):
  ```typescript
  const existing = await sdk.find({
    collection: 'otps',
    where: { phone: { equals: normalizedPhone } },
    limit: 1,
    depth: 0,
  })
  ...
  if (record.code !== normalizedCode) {
    const nextAttempts = Number(record.attempts || 0) + 1
    await sdk.update({
      collection: 'otps',
      id: record.id,
      data: {
        attempts: nextAttempts,
        code: nextAttempts >= MAX_ATTEMPTS ? null : record.code,
      },
    })
  ```
- **تحلیل فنی**:
  شمارش تعداد تلاش‌های اشتباه (`attempts`) با یک خواندن ساده و سپس به‌روزرسانی در دیتابیس انجام می‌شود و فاقد تراکنش یا قفل سطری است.
  اگر مهاجم به‌صورت همزمان ۵۰ درخواست تایید با کدهای تصادفی بفرستد، تمام ۵۰ درخواست پیش از اینکه اولین به‌روزرسانی مقدار `attempts` را در دیتابیس ثبت کند، مقدار `attempts: 0` را می‌خوانند. با توجه به اینکه کد OTP تنها ۴ رقم دارد (`1000` تا `9999` یعنی تنها ۹٬۰۰۰ حالت)، این آسیب‌پذیری امکان Brute-force را در چند ثانیه فراهم می‌سازد.

### ۵.۳. هاردکد بودن کلیدهای محرمانه و وب‌سرویس در سورس‌کد
- در `apps/api/src/lib/kavenegar.ts` خط ۳۵:
  ```typescript
  const DEFAULT_API_KEY = '46437751615871547A59364B75376339706E72384266734A596F3476644B653641356171462F557A5747383D'
  ```
- در `docker-compose.yml` خطوط ۸ و ۳۴:
  رمز عبور دیتابیس در مقدار پیش‌فرض متغیرها درج شده است: `postgresql://postgres:8228@postgres:5432/persianpart_cms`.

### ۵.۴. فقدان خاموشی امن و رها شدن تراکنش‌ها (No Graceful Shutdown)
- در هیچ‌یک از فایل‌های سرور (`apps/api/src/server.ts`) لیسنرهای سیگنال خروج نظیر `process.on('SIGTERM', ...)` یا `process.on('SIGINT', ...)` تعریف نشده‌اند.
- در سیستم‌های ابری یا زمان استقرار مجدد در Dokploy، کانتینر قدیمی بلافاصله متوقف شده و تمام تراکنش‌های باز ثبت سفارش یا بروزرسانی موجودی به شکل ناقص قطع می‌شوند.

### ۵.۵. بررسی‌های سلامت فریبنده و پرهزینه (Health Check Deficiencies)
- **بررسی سلامت API**: در `apps/api/src/server.ts:51-65` اندپوینت `/health` صرفاً وضعیت زمان بالا بودن پروسه و نگارش Bun را چک می‌کند و اتصالات به PostgreSQL یا کلاینت CMS را بررسی نمی‌کند. اگر دیتابیس به‌طور کامل Down باشد، این مسیر کماکان پاسخ 200 OK می‌دهد!
- **بررسی سلامت CMS**: در `docker-compose.yml:86` بررسی سلامت با اجرای دستور Node و واکشی روت `/admin` هر ۳۰ ثانیه یک‌بار انجام می‌شود. واکشی صفحه پنل ادمین (Next.js SSR) سربار سنگین رندرینگ به ازای هر هلت‌چک روی سرور اعمال می‌کند.

---

## ۶. فهرست جامع بدهی‌های فنی و موازنه‌ها (Technical Debt & Trade-offs Catalogue)

جدول زیر تمامی بدهی‌های فنی شناسایی‌شده را با رده‌بندی شدت، ارجاع دقیق به کد، اثر عملیاتی در شرایط بار بالا و راهکار اصلاحی مستند می‌سازد:

| شناسه | عنوان بدهی فنی | شدت | فایل و خطوط مرتبط | اثر عملیاتی در اوج بار (High Concurrency) | راهکار پیشنهادی اصلاحی (Remediation) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **TD-BE-01** | استخر اتصالات پیش‌فرض ۱۰ عددی فاقد پیکربندی در دیتابیس | **بحرانی (High)** | `apps/cms/src/payload.config.ts:149-151` | قفل شدن دیتابیس با بیش از ۱۰ درخواست همزمان و خطای ۵۰۴ | پیکربندی صریح `max: 50-100`، `idleTimeoutMillis: 10000`، `connectionTimeoutMillis: 5000` |
| **TD-BE-02** | ارتباط دولایه API به CMS از طریق HTTP REST به جای ارتباط مستقیم | **بحرانی (High)** | `apps/api/src/payload.ts:1-7`, `apps/cms/src/sdk.ts:57` | دو برابر شدن زمان پاسخ‌دهی و اشباع شدن کامل وب‌سرور Next.js | یکپارچه‌سازی لایه Data Access و اتصال مستقیم Bun به Postgres از طریق Pool مجزا |
| **TD-BE-03** | فقدان کامل لایه کش توزیع‌شده (Redis) برای کاتالوگ و داده‌های پرکاربرد | **بحرانی (High)** | کل پروژه (`apps/api`, `apps/cms`, `docker-compose.yml`) | هجوم همگانی درخواست‌ها به پایگاه داده و از دسترس خارج شدن آن | راه‌اندازی Redis/KeyDB و کش کردن محصولات، دسته‌بندی‌ها، ابعاد و توابع پرکاربرد با TTL مشخص |
| **TD-BE-04** | پردازش ترتیبی و فیلترینگ کاتالوگ در رم جاوااسکریپت (In-Memory Faceting) | **بحرانی (High)** | `apps/api/src/routers/catalog.ts:179-206` | اجرای حلقه‌های `while` طولانی، مصرف رم شدید و از کار افتادن پروسه | انتقال فیلترینگ و شمارش ابعاد به کوئری بومی SQL (`GROUP BY dimension_id`) |
| **TD-BE-05** | قفل انحصاری طولانی‌مدت در واردسازی اکسل کالاها و انبار | **بحرانی (High)** | `apps/cms/src/collections/warehouse-stock/_import.endpoints.ts:66-76` | فلج شدن کل سامانه و صف کشیدن تمام مشتریان تا پایان پردازش فایل | تفکیک عملیات به دسته‌های کوچک (Batch Chunking) و پردازش ناهمگام در صف کارهای پس‌زمینه |
| **TD-BE-06** | ارسال پیامک همگام گروهی در هوک تغییرات طرح‌های فروش | **بحرانی (High)** | `apps/cms/src/collections/plans/plans.collection.ts:58-80` | تایم‌اوت شدن درخواست ادمین و مسدودسازی چندین دقیقه‌ای سرور | انتقال ارسال پیامک به صف بادوام ناهمگام (نظیر BullMQ) با مکانیزم تلاش مجدد و محدودساز نرخ |
| **TD-BE-07** | آسیب‌پذیری شرایط مسابقه در محدودسازی حدس رمز یکبار مصرف (OTP) | **بحرانی (High)** | `apps/api/src/lib/otp.ts:155-164` | امکان Brute-force رمزهای ۴ رقمی با ارسال همزمان درخواست‌ها | استفاده از تراکنش اتمیک یا دستور اتمیک `INCR` در ردیس به همراه قفل ردیف |
| **TD-BE-08** | باطل‌سازی نشست‌ها در حافظه موقت پروسه API | **بحرانی (High)** | `apps/api/src/lib/jwt.ts:104-123` | نامعتبر بودن خروج کاربر در سناریوی چند کانتینری و بازیابی نشست‌های باطل‌شده با ری‌استارت | ذخیره‌سازی لیست سیاه یا وضعیت نشست‌ها در Redis با TTL منطبق بر انقضای توکن |
| **TD-BE-09** | فعال بودن میدلور Pretty JSON در سرور پروداکشن | **متوسط (Medium)** | `apps/api/src/server.ts:38` | اتلاف شدید توان CPU و افزایش ۵۰ درصدی پهنای باند مصرفی | حذف کامل `prettyJSON()` از محیط تولید و فعال‌سازی صرفاً در Dev |
| **TD-BE-10** | فقدان محدودکننده سراسری نرخ درخواست (Rate Limiter) | **بحرانی (High)** | `apps/api/src/server.ts:33-50` | آسیب‌پذیری در برابر DoS، استخراج داده‌ها و تحمیل هزینه بالای پیامک | افزودن میان‌افزار Rate Limiting مبتنی بر IP و شناسه کاربر با ذخیره‌ساز توزیع‌شده |
| **TD-BE-11** | فقدان مهلت زمانی (Timeout) در درخواست‌های وب‌سرویس پیامک کاوه‌نگار | **متوسط (Medium)** | `apps/api/src/lib/kavenegar.ts:72-84` | معلق ماندن بی‌نهایت اتصالات در زمان قطعی یا کندی اینترنت | افزودن `AbortSignal.timeout(5000)` به تمام فراخوانی‌های fetch خارجی |
| **TD-BE-12** | هاردکد بودن کلیدهای دسترسی حساس در سورس‌کد پروژه | **متوسط (Medium)** | `apps/api/src/lib/kavenegar.ts:35-36`, `docker-compose.yml:8,41` | خطرات نشت امنیتی کلیدها در کنترل نسخه | اجباری‌سازی دریافت کلیدها از Environment Variables و حذف Fallbackهای هاردکد |
| **TD-BE-13** | شرایط مسابقه در ویرایش آدرس‌های کاربر (Lost Update) | **متوسط (Medium)** | `apps/api/src/routers/shopping.ts:44-70` | پاک شدن تغییرات موازی ثبت‌شده توسط کاربر | افزودن کنترل همزمانی خوش‌بینانه با کلید نسخه (`revision` / `version`) |
| **TD-BE-14** | اجرای تک‌پروسه‌ای و محبوس در ۱ هسته CPU در داکر کامپوز | **متوسط (Medium)** | `apps/api/Dockerfile:44`, `docker-compose.yml:54-56` | عدم استفاده از هسته‌های باقیمانده سرورهای چند هسته‌ای | فعال‌سازی ساختار چندپروسه‌ای یا تعریف چندین Replica پشت Nginx/Traefik |
| **TD-BE-15** | جستجوی متنی فاقد نمایه و اسکن کامل جدول با LIKE چندستونه | **متوسط (Medium)** | `apps/cms/src/endpoints/catalog-browse.endpoint.ts:25-35` | اشباع ۱۰۰ درصدی CPU دیتابیس در زمان جستجوهای همزمان | ایجاد نمایه چندزبانه GIN/Trigram یا استفاده از سیستم Full-Text Search بومی |
| **TD-BE-16** | پیاده‌سازی ساختگی و بدون اعتبار درگاه پرداخت (Dummy Stub) | **متوسط (Medium)** | `apps/api/src/routers/shopping.ts:142-166` | امکان ثبت نهایی سفارشات بدون تراکنش مالی واقعی | پیاده‌سازی ماژول رسمی اتصال به درگاه بانکی شاپرک با اعتبارسنجی اتمیک سند تراکنش |
| **TD-BE-17** | فقدان مدیریت خاموشی بدون وقفه (Graceful Shutdown) | **پایین (Low)** | `apps/api/src/server.ts:271-277` | قطع ناگهانی تراکنش‌های در حال پردازش در حین دپلویمنت | شنود سیگنال‌های SIGINT/SIGTERM و فراخوانی متوقف‌سازی منظم اتصالات |
| **TD-BE-18** | عدم پاس‌دادن کانتکست و تکرار واکشی پروفایل در توابع دسترسی | **پایین (Low)** | `apps/api/src/routers/shopping.ts:18,73,106`, `router.helpers.ts:148-166` | ارسال ۲ تا ۳ درخواست اضافه HTTP به CMS به ازای هر درخواست ساده | ارسال شیء `context` به تابع `getUserPermissions` جهت استفاده از حساب کش‌شده |
