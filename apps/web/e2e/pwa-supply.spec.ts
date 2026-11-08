import { expect, test } from '@playwright/test'

test('supply draft, stock eligibility, retry and history are independent of purchase', async ({ page }) => {
  const submissions: string[] = []
  let failSubmit = true
  let stockChanged = false
  let sourceGone = false
  let committedKey: string | null = null
  let previewFailure = false
  const now = new Date().toISOString()
  const doc = { id: 42, requestNumber: 'SPR-fixture', status: 'new', productId: 1, productName: 'کاشی تست', productSku: 'T1', productImage: null, warehouseId: 7, warehouseName: 'انبار استعلامی', warehouseCode: 'I1', productType: 'tile', unit: 'm2', requestedQuantity: 80, packageCount: 56, roundedQuantity: 80.64, salesFactor: 1.44, cartonsPerPallet: 48, estimatedUnitPrice: 100, estimatedTotal: 8064, notes: '', createdAt: now, updatedAt: now, responseDueAt: new Date(Date.now() + 172800000).toISOString(), reviewStartedAt: null, resolvedAt: null, cancelledAt: null, canCancel: true, isOverdue: false }
  await page.route('**/api/rpc/**', async route => {
    const url = route.request().url()
    const body = route.request().method() === 'POST' ? route.request().postDataJSON()?.json ?? {} : JSON.parse(decodeURIComponent(new URL(url).searchParams.get('data') ?? '%7B%22json%22%3A%7B%7D%7D')).json
    let result: unknown = []
    if (url.includes('auth/session')) result = { user: { id: '1', status: 'active' } }
    else if (url.includes('user/profile')) result = { id: '1', contactName: 'کاربر تست', storeName: 'فروشگاه تست', mobile: '09120000001', status: 'active' }
    else if (url.includes('warehouse/availability')) result = { warehouses: [{ id: 2, name: 'انبار خرید', code: 'E2' }], items: (body.items ?? []).map((item: { productId: number; requestedArea: number }) => { const cartonCount = Math.ceil(item.requestedArea / 1.44); const deliverableArea = Math.round(cartonCount * 144) / 100; return { ...item, cartonCount, deliverableArea, sqmPerCarton: 1.44, productType: 'tile', unit: 'm2', unitPrice: 100, totalPrice: Math.round(deliverableArea * 100) } }) }
    else if (url.includes('catalog/list')) result = { items: [{ id: 1, name: 'کاشی تست', sku: 'T1', slug: 'test', productType: 'tile', sqmPerCarton: 1.44, cartonsPerPallet: 48, hasSupplySource: !sourceGone, inventorySqm: 0, stockCartons: 0, availability: 'out_of_stock', finalCustomerPricePerSqm: 100 }], total: 1, totalPages: 1, page: 1, limit: 500 }
    else if (url.includes('supplyRequest/preview')) {
      if (previewFailure) { await route.abort(); return }
      const quantity = Number(body.requestedQuantity)
      const count = Math.ceil(quantity * 100 / 144)
      result = { eligible: quantity > 1 && !stockChanged, reason: quantity > 1 && !stockChanged ? null : 'exact_stock_available', warehouses: [{ id: 7, name: 'انبار استعلامی', code: 'I1' }], quote: { productId: 1, productType: 'tile', unit: 'm2', requestedQuantity: quantity, packageCount: count, roundedQuantity: count * 1.44, salesFactor: 1.44, cartonsPerPallet: 48, estimatedUnitPrice: 100, estimatedTotal: Math.round(count * 144) } }
    } else if (url.includes('supplyRequest/submit')) {
      submissions.push(body.idempotencyKey)
      if (failSubmit) { committedKey = body.idempotencyKey; await route.abort(); return }
      if (body.idempotencyKey === committedKey) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ json: doc }) }); return }
      if (stockChanged) { await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ json: { code: 'EXACT_STOCK_AVAILABLE', message: 'موجودی کافی است', defined: true } }) }); return }
      result = doc
    } else if (url.includes('supplyRequest/list')) result = { items: [doc], total: 1, page: 1, limit: 20, totalPages: 1 }
    else if (url.includes('supplyRequest/detail')) result = doc
    else if (url.includes('order/list')) result = { items: [], total: 0, page: 1, limit: 20, totalPages: 1 }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ json: result }) })
  })
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('persianpart_token', 'browser-fixture')
    localStorage.setItem('persianpart_auth', JSON.stringify({ user: { id: '1', name: 'کاربر تست', storeName: 'فروشگاه تست' } }))
    localStorage.setItem('persianpart_draft_v3:1', JSON.stringify({ version: 3, selectedIds: ['99'], quantities: { '99': 5 }, warehouse: { id: 2, name: 'انبار خرید', code: 'E2' } }))
  })
  await page.goto('/product?inStock=true&q=کاشی')
  await page.getByRole('button', { name: 'درخواست تأمین', exact: true }).click()
  await page.getByRole('button', { name: /پاک کردن فیلترها/ }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false)
  expect(new URL(page.url()).searchParams.get('inStock')).toBe('true')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.assign(window, { restoreSupplyStorage: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('persianpart_supply_draft_v1:')) throw new Error('fixture storage failure'); original.call(this, key, value) }
  })
  await page.getByText('کاشی تست', { exact: true }).first().click()
  await expect(page.getByText('موجودی قطعی برای این مقدار کافی است.')).toBeVisible()
  await page.getByLabel('مقدار درخواستی (مترمربع)').fill('80')
  await expect(page.getByText('۱ پالت و ۸ کارتن', { exact: true })).toBeVisible()
  const submit = page.getByRole('button', { name: 'ثبت درخواست تأمین', exact: true })
  await expect(submit).toBeDisabled()
  await page.evaluate(() => (window as unknown as { restoreSupplyStorage: () => void }).restoreSupplyStorage())
  await page.getByRole('button', { name: 'تلاش دوباره', exact: true }).click()
  await expect(submit).toBeEnabled()
  previewFailure = true
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByRole('alert').filter({ hasText: 'دریافت برآورد ممکن نشد' })).toBeVisible()
  await expect(submit).toBeDisabled()
  previewFailure = false
  await page.getByRole('alert').getByRole('button', { name: 'تلاش دوباره' }).click()
  await expect(submit).toBeEnabled()
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/persianpart-supply-${width}.png` })
  }
  await submit.click()
  await expect(page.getByRole('alert').filter({ hasText: 'ثبت درخواست تأیید نشد' })).toBeVisible()
  await expect(page.getByLabel('یادداشت (اختیاری)')).toBeDisabled()
  failSubmit = false
  sourceGone = true
  stockChanged = true
  await page.reload()
  await expect(page.getByText('پاسخ ثبت درخواست قبلی دریافت نشده است.')).toBeVisible()
  await page.getByRole('button', { name: 'پیگیری ثبت قبلی', exact: true }).click()
  await page.waitForURL('**/orders?**')
  await expect(page.getByRole('heading', { name: 'جزئیات درخواست تأمین' })).toBeVisible()
  expect(submissions).toHaveLength(2)
  expect(submissions[0]).toBe(submissions[1])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('persianpart_draft_v3:1') ?? '{}').selectedIds)).toContain('99')
  sourceGone = false
  stockChanged = false
  committedKey = null
  await page.goto('/product?mode=supply')
  await page.getByText('کاشی تست', { exact: true }).first().click()
  await page.getByLabel('مقدار درخواستی (مترمربع)').fill('80')
  await expect(page.getByRole('button', { name: 'ثبت درخواست تأمین', exact: true })).toBeEnabled()
  stockChanged = true
  await page.getByRole('button', { name: 'ثبت درخواست تأمین', exact: true }).click()
  const purchaseAction = page.getByRole('dialog').getByRole('button', { name: 'خرید از موجودی', exact: true })
  await expect(purchaseAction).toBeVisible()
  await purchaseAction.click()
  await expect(page.getByText(/برای خرید «کاشی تست»، مقدار ۸۰/)).toBeVisible()
  await page.getByRole('button', { name: 'افزودن این مقدار به سبد' }).click()
  await page.waitForURL('**/product/new')
  const purchaseDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('persianpart_draft_v3:1') ?? '{}'))
  expect(purchaseDraft.quantities).toMatchObject({ '1': 80, '99': 5 })
  expect(purchaseDraft.warehouse.id).toBe(2)
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('live local web to API to CMS supply flow', async ({ page }) => {
  test.skip(process.env.SUPPLY_BROWSER_LIVE !== 'true', 'requires disposable local CMS and API fixtures')
  expect(process.env.SUPPLY_TEST_API_ORIGIN).toBe('http://127.0.0.1:55175')
  const { createHmac } = await import('node:crypto')
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const seconds = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({ sub: '1', role: 'customer', iss: 'persianpart.shop', aud: 'persianpart-client', iat: seconds, exp: seconds + 3600 })
  const signature = createHmac('sha256', 'test-only-secret-not-for-any-deployment-1234567890').update(`${header}.${payload}`).digest('base64url')
  const token = `${header}.${payload}.${signature}`
  await page.route('**/api/rpc/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:55175${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.goto('/login')
  await page.evaluate(token => {
    localStorage.clear()
    localStorage.setItem('persianpart_token', token)
    localStorage.setItem('persianpart_auth', JSON.stringify({ user: { id: '1', name: 'Fixture' } }))
  }, token)
  await page.goto('/product')
  await page.getByRole('button', { name: 'درخواست تأمین', exact: true }).click()
  await page.getByText('Tile', { exact: true }).first().click()
  await page.getByLabel('مقدار درخواستی (مترمربع)').fill('200')
  await expect(page.getByText(/۲۰۰٫۱۶|۲۰۰\.۱۶/).first()).toBeVisible()
  await page.getByRole('button', { name: 'ثبت درخواست تأمین', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'جزئیات درخواست تأمین' })).toBeVisible()
  await expect(page.getByText('Tile', { exact: true }).last()).toBeVisible()
})
