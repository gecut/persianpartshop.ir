async (page) => {
  await page.unroute('**/api/rpc/**')
  const product = { id: 501, name: 'کاشی اسکن‌شده', sku: 'T501', hasScanCode: true, slug: 't501', isActive: true, productType: 'tile', category: { id: 3, name: 'کاشی', slug: 'tile' }, sqmPerCarton: 1, inventorySqm: 20, stockCartons: 20, availability: 'available', finalCustomerPricePerSqm: 100, gallery: [], tags: [], richDescription: { root: { children: [{ children: [{ text: 'توضیح آزمایشی محصول' }] }] } } }
  let scans = 0
  let scanMode = 'success'
  await page.route('**/product-qr-fixture.png', route => route.fulfill({ path: 'apps/web/e2e/fixtures/product-qr.png', contentType: 'image/png' }))
  await page.route('**/api/rpc/**', async route => {
    const url = route.request().url()
    let result = []
    if (url.includes('user/profile')) result = { id: '1', fullName: 'فروشنده', canUseProductQr: true, allowedCategories: [{ id: 3, name: 'کاشی', slug: 'tile' }] }
    else if (url.includes('auth/session')) result = { user: { id: '1' } }
    else if (url.includes('catalog/list')) result = { items: [], total: 0, page: 1, limit: 500, totalPages: 1 }
    else if (url.includes('catalog/getByScanCode')) {
      scans++
      if (scanMode === 'fail') { await route.abort(); return }
      if (scanMode === 'slow') await page.waitForTimeout(1500)
      else await page.waitForTimeout(150)
      result = product
    }
    else if (url.includes('catalog/getProductQr')) result = { scanCode: 'PP-001' }
    else if (url.includes('catalog/getById')) result = product
    else if (url.includes('warehouse/availability')) result = { warehouses: [{ id: 1, code: 'W1', name: 'انبار' }], items: [{ productId: 501, productType: 'tile', unit: 'm2', requestedArea: 1, cartonCount: 1, deliverableArea: 1, sqmPerCarton: 1, unitPrice: 100, totalPrice: 100 }] }
    await route.fulfill({ json: { json: result } })
  })
  await page.addInitScript(() => {
    localStorage.setItem('persianpart_token', 'browser-fixture')
    localStorage.setItem('persianpart_auth', JSON.stringify({ user: { id: '1', name: 'فروشنده', canUseProductQr: true, allowedCategoryIds: [3] } }))
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (this.srcObject instanceof MediaStream && window.__playMode === 'reject') return Promise.reject(new Error('Playback failed'))
      if (this.srcObject instanceof MediaStream && window.__playMode === 'timeout') return new Promise(() => {})
      return originalPlay.call(this)
    }
    const media = navigator.mediaDevices
    Object.defineProperty(media, 'getUserMedia', { configurable: true, value: async () => {
      if (window.__denyCamera) throw new DOMException('Denied', 'NotAllowedError')
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
      const image = new Image(); image.src = '/product-qr-fixture.png'; await image.decode()
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 512, 512)
      if (window.__outsideQr) ctx.drawImage(image, 0, 180, 150, 150)
      else ctx.drawImage(image, 0, 0, 512, 512)
      window.__testCameraCanvas = canvas
      window.__testCameraImage = image
      const stream = canvas.captureStream(10)
      window.__testCameraStream = stream
      return stream
    } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:55173/product')
  await page.evaluate(() => { window.__outsideQr = true })
  await page.getByRole('button', { name: 'اسکن محصول' }).click()
  await page.waitForTimeout(2000)
  if (scans !== 0) throw new Error('QR outside the frame triggered lookup')
  await page.evaluate(() => window.__testCameraCanvas.getContext('2d').drawImage(window.__testCameraImage, 0, 0, 512, 512))
  await page.getByRole('heading', { name: 'کاشی اسکن‌شده' }).waitFor({ timeout: 20000 })
  await page.getByText('توضیح آزمایشی محصول').waitFor()
  if (scans !== 1) throw new Error(`Expected one lookup, got ${scans}`)
  if (await page.evaluate(() => window.__testCameraStream.getTracks().some(track => track.readyState !== 'ended'))) throw new Error('Camera was not released')
  await page.keyboard.press('Escape')
  if (!(await page.getByRole('heading', { name: 'کاشی اسکن‌شده' }).isVisible())) throw new Error('Escape closed the product sheet')
  await page.mouse.click(5, 20)
  if (!(await page.getByRole('heading', { name: 'کاشی اسکن‌شده' }).isVisible())) throw new Error('Backdrop closed the product sheet')
  await page.getByRole('button', { name: 'دریافت QR محصول' }).click()
  await page.getByAltText('کد QR محصول').waitFor()
  const svg = page.waitForEvent('download'); await page.getByRole('button', { name: 'دانلود SVG' }).click(); if (!(await svg).suggestedFilename().endsWith('.svg')) throw new Error('SVG download missing')
  const png = page.waitForEvent('download'); await page.getByRole('button', { name: 'دانلود PNG' }).click(); if (!(await png).suggestedFilename().endsWith('.png')) throw new Error('PNG download missing')
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('persianpart_draft_v3:1') ?? '{}').selectedIds?.includes('501'))
  const handle = await page.locator('[data-slot="drawer-handle"]').boundingBox()
  if (!handle) throw new Error('Drawer handle is missing')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 550, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('heading', { name: 'کاشی اسکن‌شده' }).waitFor({ state: 'hidden' })
  await page.goto('http://127.0.0.1:55173/product/new')
  await page.getByText('کاشی اسکن‌شده').first().waitFor()
  await page.goto('http://127.0.0.1:55173/product')
  await page.evaluate(() => { window.__denyCamera = true })
  await page.getByRole('button', { name: 'اسکن محصول' }).click()
  await page.getByText('دسترسی دوربین را در تنظیمات مرورگر فعال کنید.').waitFor()
  await page.getByRole('button', { name: 'بستن اسکنر' }).click()
  await page.evaluate(() => { window.__denyCamera = false })
  for (const mode of ['reject', 'timeout']) {
    await page.evaluate(mode => { window.__playMode = mode }, mode)
    await page.getByRole('button', { name: 'اسکن محصول' }).click()
    await page.getByText('دسترسی به دوربین ممکن نشد. تنظیمات دستگاه را بررسی کنید.').waitFor({ timeout: 8000 })
    if (await page.evaluate(() => window.__testCameraStream.getTracks().some(track => track.readyState !== 'ended'))) throw new Error(`Camera leaked after ${mode}`)
    await page.getByRole('button', { name: 'بستن اسکنر' }).click()
  }
  await page.evaluate(() => { window.__playMode = ''; window.__outsideQr = false })
  scanMode = 'fail'
  await page.getByRole('button', { name: 'اسکن محصول' }).click()
  await page.getByText('دریافت محصول ممکن نشد. اتصال اینترنت و دسترسی حساب را بررسی کنید.').waitFor()
  scanMode = 'success'
  await page.getByRole('button', { name: 'تلاش مجدد', exact: true }).click()
  await page.getByRole('heading', { name: 'کاشی اسکن‌شده' }).waitFor()
  await page.getByRole('button', { name: 'بستن', exact: true }).click()
  scanMode = 'slow'
  await page.getByRole('button', { name: 'اسکن محصول' }).click()
  await page.getByText('در حال دریافت اطلاعات محصول…').waitFor()
  await page.getByRole('button', { name: 'بستن اسکنر' }).click()
  await page.waitForTimeout(1800)
  if (await page.getByRole('heading', { name: 'کاشی اسکن‌شده' }).count()) throw new Error('Late response opened a closed scanner')
  return 'QR scan, permission errors, retry, cancellation, camera cleanup, sheet dismissal, downloads and product outside initial list: PASS'
}
