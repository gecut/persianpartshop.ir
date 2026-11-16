// Run in a fresh Chromium Playwright CLI session against the web preview on port 55177.
async page => {
  const base = 'http://localhost:55177'
  const user = { id: '1', fullName: 'Viewer Tester', phone: '09120000000' }
  const record = {
    id: 1, name: 'Viewer fixture', sku: 'PP-1', slug: 'viewer-fixture',
    createdAt: '2026-01-01T00:00:00.000Z', inventorySqm: 3, stockCartons: 3,
    availability: 'available', finalCustomerPricePerSqm: 100, hasScanCode: false,
    cover: { url: '/api/media/file/viewer-cover.jpg', sizes: { galleryThumb: { url: '/api/media/file/viewer-cover-256.webp' } } },
    gallery: [1, 2, 3].map(id => ({ image: { id, url: '/api/media/file/viewer-' + id + '.jpg', sizes: {
      galleryThumb: { url: '/api/media/file/viewer-' + id + '-256.webp' },
      galleryPreview: { url: '/api/media/file/viewer-' + id + '-1024.webp' },
    } } })),
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(user => {
    localStorage.setItem('persianpart_token', 'fixture')
    localStorage.setItem('persianpart_auth', JSON.stringify({ user }))
  }, user)
  const requests = []
  await page.context().route('**/api/media/file/viewer-*', route => {
    requests.push(route.request().url().split('/').pop())
    return route.fulfill({
      path: 'apps/web/public/api/media/file/tile-calacatta-gold.jpg',
      contentType: 'image/jpeg',
    })
  })
  await page.route('**/api/rpc/**', route => {
    const path = route.request().url().split('/api/rpc/')[1]
    const scopeKey = 'viewer-fixture'
    const items = [record]
    const result = path === 'auth/session' ? { user, catalogScopeKey: scopeKey, offlineAccessUntil: Date.now() + 86400000 }
      : path === 'catalog/browse' ? { scopeKey, items, total: 1, hasMore: false }
        : path === 'catalog/facets' ? { scopeKey, dimensions: [] }
          : { scopeKey, items, nextCursor: null }
    return route.fulfill({ json: { json: result } })
  })
  await page.goto(base + '/product')
  const cover = page.getByRole('img', { name: record.name, exact: true })
  await page.waitForFunction(name => Array.from(document.images).some(image =>
    image.alt === name && image.src.endsWith('viewer-cover-256.webp') && image.naturalWidth > 0), record.name)
  await cover.click()
  const gallery = page.getByRole('region', { name: 'تصاویر محصول' })
  await gallery.locator('img[src$="/viewer-1-1024.webp"]').waitFor()
  await gallery.locator('img[src$="/viewer-1-256.webp"]').waitFor()
  if (requests.some(path => path.endsWith('.jpg'))) throw Error('The card or gallery requested an original')
  await page.getByRole('button', { name: 'بزرگ‌نمایی تصویر ۱' }).click()
  const viewer = page.getByRole('dialog', { name: 'نمایشگر تصاویر محصول' })
  const counter = viewer.locator('.product-viewer__counter')
  await counter.waitFor()
  await viewer.locator('img[src$="/viewer-1.jpg"]').waitFor()
  if (requests.some(path => /^viewer-[23]\.jpg$/.test(path))) throw Error('The viewer requested a neighboring original')
  const client = await page.context().newCDPSession(page)
  const touch = (type, ...touchPoints) => client.send('Input.dispatchTouchEvent', { type, touchPoints })
  const finger = (id, x) => ({ id, x, y: 422 })
  const startSwipe = async () => {
    await touch('touchStart', finger(1, 75))
    for (const x of [115, 160, 300]) await touch('touchMove', finger(1, x))
  }
  await startSwipe()
  await touch('touchStart', finger(1, 300), finger(2, 220))
  await touch('touchMove', finger(1, 315), finger(2, 185))
  await touch('touchMove', finger(1, 320), finger(2, 165))
  await touch('touchEnd', finger(2, 165))
  await touch('touchMove', finger(2, 140))
  await touch('touchEnd')
  await page.waitForTimeout(350)
  if (await counter.innerText() !== '۱ از ۳') throw Error('Pinch committed an interrupted swipe')

  const zoomOut = viewer.getByRole('button', { name: 'بزرگ‌نمایی کمتر' })
  for (let i = 0; i < 3 && !await zoomOut.isDisabled(); i++) {
    await zoomOut.click()
    await page.waitForTimeout(220)
  }
  await startSwipe()
  await touch('touchCancel')
  await page.waitForTimeout(350)
  if (await counter.innerText() !== '۱ از ۳') throw Error('Touch cancellation committed the swipe')

  await startSwipe()
  await touch('touchEnd')
  await page.waitForFunction(() => document.querySelector('.product-viewer__counter')?.textContent === '۲ از ۳')
  await page.keyboard.press('Escape')
  await viewer.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'بزرگ‌نمایی تصویر ۲')
}
