async (page) => {
  await page.unroute('**/api/rpc/**')
  let warehouses = [{ id: 1, code: 'W1', name: 'انبار یک' }]
  let delay = 0
  let submitFailure = true
  const submitKeys = []
  await page.route('**/api/rpc/**', async route => {
    const path = route.request().url().split('?')[0]
    let body = { json: {} }
    if (route.request().method() === 'POST') body = route.request().postDataJSON()
    else {
      const data = route.request().url().match(/[?&]data=([^&]+)/)?.[1]
      if (data) body = JSON.parse(decodeURIComponent(data))
    }
    let result = []
    if (path.includes('warehouse/availability')) {
      if (delay) await page.waitForTimeout(delay)
      result = { warehouses, items: (body.json?.items ?? []).map(item => {
        const factor = item.productId === 2 ? 1 : 1.44
        const cartonCount = Math.ceil(item.requestedArea / factor), deliverableArea = Math.round(cartonCount * factor * 100) / 100
        return { ...item, productType: item.productId === 2 ? 'other' : 'tile', unit: item.productId === 2 ? 'bag' : 'm2', cartonCount, deliverableArea, sqmPerCarton: factor, unitPrice: 100, totalPrice: Math.round(deliverableArea * 100) }
      }) }
    } else if (path.includes('user/profile')) result = { id: '1', contactName: 'کاربر تست', storeName: 'فروشگاه تست', mobile: '09120000001', status: 'active' }
    else if (path.includes('auth/session')) result = { user: { id: '1', status: 'active' } }
    else if (path.includes('order/submit')) {
      submitKeys.push(body.json?.idempotencyKey)
      if (submitFailure) { await route.abort(); return }
      result = { id: submitKeys.length > 2 ? 9 : 8, orderNumber: 'ptp 8', warehouseName: 'انبار یک', warehouse: 1, user: 1, status: 'pending', subtotal: 100, finalTotal: 100, items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    } else if (path.includes('order/getById')) result = { id: Number(body.json?.id ?? 8), orderNumber: 'ptp 8', status: 'pending', user: 1, warehouse: 1, subtotal: 444, finalTotal: 444, updatedAt: new Date().toISOString(), warehouseName: 'انبار یک', createdAt: new Date().toISOString(), items: [{ product: { id: 1, name: 'کاشی تست', sku: 'TEST', slug: 'test', sqmPerCarton: 1.44, width: 60, height: 120 }, productType: 'tile', unit: 'm2', requestedArea: 1, cartonCount: 1, deliverableArea: 1.44, unitPrice: 100, totalPrice: 144 }, { product: { id: 2, name: 'چسب نمونه', sku: 'BAG', slug: 'bag', productType: 'other', unit: 'bag' }, productType: 'other', unit: 'bag', requestedArea: 2.2, cartonCount: 3, deliverableArea: 3, unitPrice: 100, totalPrice: 300 }] }
    else if (path.includes('catalog/list')) result = { items: [], total: 0, totalPages: 1, page: 1, limit: 100 }
    if (delay && path.includes('order/getById')) await page.waitForTimeout(delay)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ json: result }) })
  })
  await page.goto('http://127.0.0.1:55173/login')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('persianpart_selected_products', '["1"]')
    localStorage.setItem('persianpart_product_quantities', '{"1":10}')
    localStorage.setItem('persianpart_cart_v2', JSON.stringify({ items: [{ productId: '1', requestedArea: 15 }, { productId: '2', requestedArea: 20 }] }))
    localStorage.setItem('persianpart_token', 'browser-fixture')
    localStorage.setItem('persianpart_auth', JSON.stringify({ user: { id: '1', name: 'کاربر تست', storeName: 'فروشگاه تست' } }))
  })
  await page.goto('http://127.0.0.1:55173/cart')
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/selection-store.ts')))
  const storeUrl = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/selection-store.ts')).sort((a, b) => Number(a.name.match(/[?&]t=(\d+)/)?.[1] ?? 0) - Number(b.name.match(/[?&]t=(\d+)/)?.[1] ?? 0)).at(-1).name)
  const action = code => page.evaluate(async ({code, storeUrl}) => {
    const { selectionStore } = await import(storeUrl)
    return await new Function('store', `return (async () => { ${code} })()`)(selectionStore)
  }, { code, storeUrl })
  const check = (value, message) => { if (!value) throw new Error(message) }
  const migrated = await action('return store.getSnapshot()')
  check(migrated.selectedIds.length === 2 && migrated.quantities['1'] === 15 && migrated.warehouse === null, 'legacy stores must be preserved, merged and require fresh warehouse validation')
  await action('store.clearSelection()')
  await action("await store.setQuantity('1', 50)")
  let state = await action('return store.getSnapshot()')
  check(state.warehouse?.id === 1 && state.quotes[0]?.deliverableArea === 50.4, 'single warehouse must bind automatically')
  warehouses = [{ id: 2, code: 'W2', name: 'انبار دو' }]
  await action("await store.setQuantity('2', 20)")
  state = await action('return store.getSnapshot()')
  check(state.selectedIds.join() === '1' && state.warehouse.id === 1, 'incompatible addition must preserve the original cart')
  await action('store.clearSelection()')
  warehouses = [{ id: 1, code: 'W1', name: 'انبار یک' }, { id: 2, code: 'W2', name: 'انبار دو' }]
  await action("void store.setQuantity('1', 10)")
  await page.getByRole('button', { name: 'انبار دو', exact: true }).waitFor()
  state = await action('return store.getSnapshot()')
  check(state.warehouse === null && state.selectedIds.length === 0, 'multiple warehouses must have no default or premature cart mutation')
  await page.getByRole('button', { name: 'انبار دو', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(async url => (await import(url)).selectionStore.getSnapshot().warehouse?.id === 2, storeUrl)
  await action("store.unselectProduct('1')")
  state = await action('return store.getSnapshot()')
  check(state.warehouse === null, 'last removal must release the warehouse')
  warehouses = []
  await action("await store.setQuantity('1', 500)")
  check((await action('return store.getSnapshot()')).selectedIds.length === 0, 'zero candidates must block additions')
  warehouses = [{ id: 1, code: 'W1', name: 'انبار یک' }]
  delay = 200
  await action("void store.setQuantity('1', 50); store.setOwner('2')")
  await page.waitForTimeout(300)
  check((await action('return store.getSnapshot()')).selectedIds.length === 0, 'old account response must not mutate a new account cart')
  delay = 0
  await action("store.setOwner('1'); await store.setQuantity('1', 50)")
  await action("const original = store.submissionSnapshot(); await store.setQuantity('1', 60); store.finishSubmission(original)")
  check((await action('return store.getSnapshot()')).quantities['1'] === 60, 'submit response must preserve edits made after submission')
  await page.setViewportSize({ width: 360, height: 800 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile horizontal overflow')
  await page.screenshot({ path: '/tmp/persianpart-warehouse-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: '/tmp/persianpart-warehouse-desktop.png', fullPage: true })
  const other = await page.context().newPage()
  await other.route('**/api/rpc/**', route => {
    const url = route.request().url()
    const result = url.includes('auth/session') ? { user: { id: '1', status: 'active' } } : url.includes('user/profile') ? { id: '1', contactName: 'کاربر تست', mobile: '09120000001', status: 'active' } : []
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ json: result }) })
  })
  await other.goto('http://127.0.0.1:55173/cart')
  await other.evaluate(() => localStorage.setItem('persianpart_draft_v3:1', JSON.stringify({ version: 3, selectedIds: ['1'], quantities: { '1': 30 }, warehouse: { id: 1, code: 'W1', name: 'انبار یک' } })))
  await page.waitForFunction(async url => (await import(url)).selectionStore.getSnapshot().quantities['1'] === 30, storeUrl)
  check((await action('return store.getSnapshot()')).quotes.length === 0, 'cross-tab changes must require revalidation')
  await other.close()
  await action('await store.revalidate()')
  await page.getByRole('button', { name: 'ادامه ثبت سفارش' }).click()
  await page.getByRole('button', { name: 'ثبت نهایی سفارش', exact: true }).click()
  await page.getByText('خطا در ثبت سفارش', { exact: true }).waitFor()
  check((await action('return store.getSnapshot()')).selectedIds.length === 1, 'network failure must preserve the cart')
  submitFailure = false
  await page.getByRole('button', { name: 'ثبت نهایی سفارش', exact: true }).click()
  await page.waitForURL('**/orders/8')
  check((await action('return store.getSnapshot()')).selectedIds.length === 0, 'confirmed server success must clear the submitted cart')
  check(submitKeys.length === 2 && submitKeys[0] === submitKeys[1], 'network retry must preserve its idempotency key')
  warehouses = [{ id: 1, code: 'W1', name: 'انبار یک' }, { id: 2, code: 'W2', name: 'انبار دو' }]
  await page.getByRole('button', { name: 'سفارش مجدد', exact: true }).click()
  await page.getByRole('button', { name: 'انبار دو', exact: true }).waitFor()
  check((await action('return store.getSnapshot()')).warehouse === null, 'reorder must not reuse its historical warehouse')
  await page.getByRole('button', { name: 'انبار دو', exact: true }).click()
  await page.getByRole('slider', { name: 'برای ثبت سفارش بکشید', exact: true }).waitFor()
  await page.waitForFunction(async url => !(await import(url)).selectionStore.getSnapshot().busy, storeUrl)
  check(await page.getByText('۳ کیسه', { exact: true }).count() > 0, 'non-tile preinvoice must show bags')
  await page.getByRole('slider', { name: 'برای ثبت سفارش بکشید', exact: true }).focus()
  await page.keyboard.press('End')
  await page.waitForURL('**/orders/9')
  check((await action('return store.getSnapshot()')).selectedIds.length === 0, 'reorder must create a new confirmed order and clear only its draft')
  await page.goto('http://127.0.0.1:55173/orders/10')
  await page.getByText('چسب نمونه', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'دریافت پیش‌فاکتور', exact: true }).click()
  check(await page.getByText('تخفیف ویژه اپلیکیشن (۱٪):', { exact: true }).count() === 0, 'invoice must not invent a discount')
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mixed invoice horizontal overflow')
    await page.screenshot({ path: `/tmp/persianpart-mixed-invoice-${width}.png`, fullPage: true })
  }
  delay = 200
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource')
    const orderUrl = resources.filter(entry => entry.name.includes('/order-store.ts')).at(-1).name
    const authUrl = resources.filter(entry => entry.name.includes('/auth-store.ts')).at(-1).name
    const { orderStore } = await import(orderUrl)
    const { authStore } = await import(authUrl)
    const pending = orderStore.fetchOrderById('11')
    authStore.logout()
    if (orderStore.getOrders().length || orderStore.getOrderById('10')) throw new Error('signed-out account must not see cached orders')
    if (await pending !== null) throw new Error('late order response must not repopulate a signed-out account')
  })
  console.log('PASS: warehouse selection, legacy migration, quantity checks, account and tab isolation, submission race, failed network retry, keyboard reorder, success and responsive layout')
}
