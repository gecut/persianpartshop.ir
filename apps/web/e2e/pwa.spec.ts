import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const user = { id: '1', name: 'همکار آزمایشی', storeName: 'فروشگاه تست', phone: '09120000001', address: '', province: '', city: '', economicCode: '', allowedCategoryIds: [] }
const product = { id: 901, name: 'محصول اشتراکی نمونه', slug: 'shared-test', sku: 'SHARED', productType: 'tile', unit: 'm2', basePrice: 100, finalCustomerPricePerSqm: 100, inventorySqm: 100, stockCartons: 10, sqmPerCarton: 1.44, width: 60, height: 120, images: [], gallery: [], availability: 'in_stock' }
async function seed(context: BrowserContext) {
  await context.addInitScript(user => {
    if (!sessionStorage.getItem('pwa-test-seeded')) {
      localStorage.setItem('persianpart_token', 'test-token')
      localStorage.setItem('persianpart_auth', JSON.stringify({ isAuthenticated: true, user, pendingPhone: null }))
      sessionStorage.setItem('pwa-test-seeded', '1')
    }
  }, user)
}
async function mock(context: BrowserContext, options: { sessionFailure?: boolean; productsFailure?: boolean; profileFailure?: boolean; delaySave?: number; productCount?: number } = {}) {
  await context.route('**/api/rpc/**', async route => {
    const path = new URL(route.request().url()).pathname
    if ((options.sessionFailure && path.endsWith('/auth/session')) || (options.productsFailure && path.endsWith('/catalog/list'))) { await route.abort(); return }
    if (path.endsWith('/user/update') && options.delaySave) await new Promise(resolve => setTimeout(resolve, options.delaySave))
    if (options.profileFailure && path.endsWith('/user/update')) {
      await route.fulfill({ status: 503, json: { json: { defined: false, code: 'SERVICE_UNAVAILABLE', status: 503, message: 'ذخیره ممکن نشد' } } }); return
    }
    let result: unknown = []
    if (path.endsWith('/auth/requestOtp')) result = { success: true, message: 'کد ارسال شد' }
    else if (path.endsWith('/auth/verifyOtp')) result = { token: 'test-token', user: { ...user, fullName: user.name, companyName: user.storeName } }
    else if (path.endsWith('/auth/session')) result = { user: { id: '1', status: 'active' } }
    else if (path.endsWith('/user/profile')) result = { ...user, fullName: user.name, companyName: user.storeName, documents: [] }
    else if (path.endsWith('/catalog/list')) result = { items: Array.from({ length: options.productCount ?? 0 }, (_, index) => ({ ...product, id: index + 1, name: `محصول تست ${index + 1}` })), total: options.productCount ?? 0, totalPages: 1, page: 1, limit: 500 }
    else if (path.endsWith('/catalog/getById')) result = product
    else if (path.endsWith('/order/list')) result = { items: [], total: 0 }
    else if (path.endsWith('/plan/list')) result = { items: [], total: 0 }
    else if (path.endsWith('/user/update')) result = user
    await route.fulfill({ json: { json: result } })
  })
}
async function openAccount(page: Page) { await page.goto('/account'); await expect(page.getByRole('button', { name: 'نصب و بروزرسانی برنامه' })).toBeVisible() }

test('transient session failure keeps authentication and shows retry', async ({ context, page }) => {
  await seed(context); await mock(context, { sessionFailure: true }); await page.goto('/product')
  await expect(page.getByText('بروزرسانی انجام نشد؛ اطلاعات قبلی نمایش داده می‌شود.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('persianpart_token'))).toBe('test-token')
  await expect(page).toHaveURL(/product/)
})
test('catalog network failure is not an empty catalog', async ({ context, page }) => {
  await seed(context); await mock(context, { productsFailure: true }); await page.goto('/product')
  await expect(page.getByText('دریافت اطلاعات ممکن نشد؛ دوباره تلاش کنید.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('محصولی با این مشخصات یافت نشد')).toHaveCount(0)
})
test('cart text survives reload and explicit logout deletes account drafts', async ({ context, page }) => {
  await seed(context); await mock(context); await page.goto('/cart')
  await page.evaluate(() => {
    localStorage.setItem('persianpart_text_v1:1:cart-notes', JSON.stringify('توضیحات ذخیره‌شده'))
    localStorage.setItem('persianpart_draft_v3:1', JSON.stringify({ version: 3, selectedIds: [], quantities: {}, warehouse: null }))
  })
  await page.reload()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('persianpart_text_v1:1:cart-notes')!))).toBe('توضیحات ذخیره‌شده')
  await openAccount(page)
  await page.getByRole('button', { name: /خروج/ }).first().click()
  await page.getByRole('button', { name: 'تأیید خروج' }).click()
  await expect(page).toHaveURL(/login/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('persianpart_text_v1:1:') || key.startsWith('persianpart_draft_v3:1')))).toEqual([])
})
test('logout synchronizes to another tab', async ({ context, page }) => {
  await seed(context); await mock(context); await openAccount(page)
  const second = await context.newPage(); await second.goto('/product')
  await page.getByRole('button', { name: /خروج/ }).first().click()
  await page.getByRole('button', { name: 'تأیید خروج' }).click()
  await expect(second).toHaveURL(/login/)
})
test('direct product link fetches outside initial list without a share control', async ({ context, page }) => {
  await seed(context); await mock(context)
  await page.goto('/product?productId=901&q=test')
  await expect(page.getByText(product.name, { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'اشتراک محصول' })).toHaveCount(0)
  await page.getByRole('button', { name: 'بستن', exact: true }).click()
  await expect(page).not.toHaveURL(/productId=/)
  await expect(page).toHaveURL(/q=test/)
})
test('installation help is accessible from account and layout stays within viewport', async ({ context, page }) => {
  await seed(context); await mock(context); await openAccount(page)
  await page.getByRole('button', { name: 'نصب و بروزرسانی برنامه' }).click()
  await expect(page.getByRole('heading', { name: 'نصب پرشین‌پارت' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/pwa-install-mobile.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('local storage failure reports unsaved draft', async ({ context, page }) => {
  await seed(context); await mock(context); await openAccount(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('persianpart_text_v1:')) throw new DOMException('Quota', 'QuotaExceededError'); original.call(this, key, value) }
  })
  await page.getByRole('button', { name: /ویرایش/ }).first().click()
  const input = page.locator('input').filter({ visible: true }).first()
  await input.fill('نام جدید')
  await expect(page.getByText('پیش‌نویس ذخیره نشد', { exact: true }).first()).toBeVisible()
})
test('failed profile save keeps editor and does not announce success', async ({ context, page }) => {
  await seed(context); await mock(context, { profileFailure: true }); await openAccount(page)
  await page.getByRole('button', { name: /ویرایش/ }).first().click()
  await page.locator('input').filter({ visible: true }).first().fill('نام ویرایش‌شده')
  await page.getByRole('button', { name: /ذخیره/ }).click()
  await expect(page.getByText('تغییرات ذخیره نشد', { exact: true }).first()).toBeVisible()
  await expect(page.locator('input').filter({ visible: true }).first()).toHaveValue('نام ویرایش‌شده')
  await expect(page.getByText('تغییرات ذخیره شد', { exact: true })).toHaveCount(0)
})
test('active writes in another tab disable update', async ({ context, page }) => {
  await seed(context); await mock(context); await openAccount(page)
  const other = await context.newPage(); await other.goto('/product')
  await other.evaluate(() => localStorage.setItem('persianpart_writing:test-peer', JSON.stringify({ count: 1, at: Date.now() })))
  await page.evaluate(() => window.dispatchEvent(new Event('persianpart:update-ready')))
  await page.getByRole('button', { name: 'مشاهدهٔ بروزرسانی' }).click()
  await expect(page.getByRole('button', { name: 'بروزرسانی اکنون' })).toBeDisabled()
})
test('manifest and offline app shell are available after installation of worker', async ({ context, page }) => {
  await seed(context); await mock(context); await page.goto('/product')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const manifest = await context.request.get('/manifest.webmanifest')
  expect((await manifest.json()).display).toBe('standalone')
  const cacheUrls = await page.evaluate(async () => { const keys = await caches.keys(); return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat() })
  expect(cacheUrls.some(url => url.includes('/api/'))).toBe(false)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(/اتصال اینترنت قطع است/)).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText(/اتصال اینترنت قطع است/)).toHaveCount(0)
})


test('login returns to the product link and offers installation only once', async ({ context, page }) => {
  await mock(context)
  await page.goto('/product?productId=901')
  await expect(page).toHaveURL(/login/)
  await page.locator('input[type="tel"]').fill('09120000001')
  await page.getByRole('button', { name: 'دریافت کد ورود' }).click()
  await page.locator('input[autocomplete="one-time-code"]').fill('1234')
  await expect(page).toHaveURL(/product\?productId=901/)
  await expect(page.getByText(product.name, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('پرشین‌پارت را روی دستگاه نصب کنید.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('پرشین‌پارت را روی دستگاه نصب کنید.')).toHaveCount(0)
})

test('profile text draft is restored after refresh and cancel discards it', async ({ context, page }) => {
  await seed(context); await mock(context); await openAccount(page)
  await page.getByRole('button', { name: /ویرایش/ }).first().click()
  await page.locator('input').filter({ visible: true }).first().fill('نام نیمه‌تمام')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('persianpart_text_v1:1:profile'))).toContain('نام نیمه‌تمام')
  await page.reload()
  await page.getByRole('button', { name: /ویرایش/ }).first().click()
  await expect(page.locator('input').filter({ visible: true }).first()).toHaveValue('نام نیمه‌تمام')
  await page.getByRole('button', { name: 'انصراف', exact: true }).first().click()
  expect(await page.evaluate(() => localStorage.getItem('persianpart_text_v1:1:profile'))).toBeNull()
})


test('virtual catalog restores its scroll position after visiting account', async ({ context, page }) => {
  await seed(context); await mock(context, { productCount: 100 }); await page.goto('/product')
  await expect(page.getByText('محصول تست 1', { exact: true })).toBeVisible()
  await page.evaluate(() => scrollTo(0, 1400))
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000)
  const previous = await page.evaluate(() => scrollY)
  await page.getByRole('link', { name: 'حساب من', exact: true }).click()
  await expect(page).toHaveURL(/account/)
  await page.goBack()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(previous - 150)
})

test('profile save blocks explicit logout until its response completes', async ({ context, page }) => {
  await seed(context); await mock(context, { delaySave: 2500 }); await openAccount(page)
  await page.getByRole('button', { name: /ویرایش/ }).first().click()
  await page.locator('input').filter({ visible: true }).first().fill('ذخیره با تأخیر')
  await page.getByRole('button', { name: 'ذخیره تغییرات', exact: true }).click()
  await expect(page.getByRole('button', { name: 'ذخیره تغییرات', exact: true })).toBeDisabled()
  await expect(page.getByText('تغییرات ذخیره شد', { exact: true }).first()).toBeVisible()
})

test('a confirmed invalid session logs out', async ({ context, page }) => {
  await seed(context); await mock(context)
  await context.route('**/api/rpc/auth/session**', route => route.fulfill({ json: { json: { user: null } } }))
  await page.goto('/product')
  await expect(page).toHaveURL(/login/)
  expect(await page.evaluate(() => localStorage.getItem('persianpart_token'))).toBeNull()
})

test('a late profile response cannot overwrite the next account', async ({ context, page }) => {
  await seed(context); await mock(context)
  await context.route('**/api/rpc/user/profile**', async route => {
    const previousAccount = route.request().headers().authorization === 'Bearer test-token'
    if (previousAccount) await new Promise(resolve => setTimeout(resolve, 1500))
    await route.fulfill({ json: { json: { ...user, id: previousAccount ? '1' : '2', fullName: previousAccount ? 'نام قدیمی دیررس' : 'حساب دوم', companyName: 'فروشگاه تست' } } })
  })
  await openAccount(page)
  await page.evaluate(() => {
    localStorage.setItem('persianpart_token', 'second-token')
    localStorage.setItem('persianpart_auth', JSON.stringify({ isAuthenticated: true, user: { id: '2', name: 'حساب دوم', storeName: 'فروشگاه تست' } }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'persianpart_auth' }))
  })
  await expect(page.getByText('حساب دوم', { exact: true }).first()).toBeVisible()
  await page.waitForTimeout(1700)
  await expect(page.getByText('نام قدیمی دیررس', { exact: true })).toHaveCount(0)
})
