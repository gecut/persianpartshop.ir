async page => {
  const context = page.context()
  const optimized = page.url().includes('?optimized-media')
  const compactCover = '/api/media/file/tile-calacatta-small-256.webp'
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  const ts = '2026-01-01T00:00:00.000Z'
  const qr = 'PP-002'
  const scanHash = await page.evaluate(async code => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))), n => n.toString(16).padStart(2, '0')).join(''), qr)
  const records = [
    { id: 1, name: 'First product', sku: 'PP-1', slug: 'p1', createdAt: ts, inventorySqm: 1, stockCartons: 1, availability: 'available', finalCustomerPricePerSqm: 100, hasScanCode: false, cover: { url: '/api/media/file/tile-calacatta-gold.jpg' } },
    { id: 2, name: 'Offline target', sku: 'PP-2', slug: 'p2', createdAt: ts, inventorySqm: 1, stockCartons: 1, availability: 'available', finalCustomerPricePerSqm: 200, hasScanCode: true, scanHash, dimension: {id:1,name:'60×120',width:60,height:120}, cover: { url: '/api/media/file/tile-calacatta-gold-1.jpg', sizes: { galleryThumb: { url: compactCover } } },
      gallery: [{ image: '/api/media/file/tile-calacatta-gold-1.jpg' }, { image: {
        url: '/api/media/file/tile-calacatta-gold.jpg',
        sizes: {
          galleryThumb: { url: '/api/media/file/tile-calacatta-gold-thumb.webp' },
          galleryPreview: { url: '/api/media/file/tile-calacatta-gold-preview.webp' },
        },
      } }] },
  ]
  const user = { id: '1', fullName: 'Offline Tester', name: 'Offline Tester', phone: '09120000000', canUseProductQr: true, documents: [{id:'1',documentType:'business_license',status:'approved',file:{url:'/private-file.png'}}] }
  const order = {id:7,orderNumber:'1234567',status:'pending',warehouse:1,user:1,items:[{product:2,productName:'Offline target',requestedArea:1,cartonCount:1,deliverableArea:1,unitPrice:200,totalPrice:200}],subtotal:200,finalTotal:200,createdAt:ts,updatedAt:ts}
  const supply = {id:7,requestNumber:'1234568',status:'new',productId:2,productName:'Offline target',productSku:'PP-2',productImage:null,warehouseId:null,warehouseName:null,warehouseCode:null,productType:'tile',unit:'m2',requestedQuantity:1,packageCount:1,roundedQuantity:1,salesFactor:1,cartonsPerPallet:null,estimatedUnitPrice:200,estimatedTotal:200,notes:'Offline supply detail',createdAt:ts,updatedAt:ts,responseDueAt:ts,reviewStartedAt:null,resolvedAt:null,cancelledAt:null,canCancel:true,isOverdue:true}
  const activity = { order:{kind:'order',id:7,orderNumber:'1234567',status:'pending',statusLabel:'ثبت‌شده',createdAt:ts,totalAmount:200,itemCount:1,quantitySummary:'1',productImages:[],canReorder:true}, supply:{kind:'supply',id:7,requestNumber:'1234568',status:'new',statusLabel:'ثبت‌شده',createdAt:ts,estimatedTotal:200,productName:'Offline target',productImage:null,requestedQuantity:1,roundedQuantity:1,unit:'m2',packageCount:1,cartonsPerPallet:null,responseDueAt:ts,canCancel:true,isOverdue:true}}
  let imageBlocked = true
  let compactBlocked = true
  const downloadedMedia = []
  if (optimized) {
    await context.route('**/api/media/file/*-256.webp', route => {
      const request = route.request()
      if (request.resourceType() === 'fetch') downloadedMedia.push(request.url().split('55177')[1])
      if (compactBlocked) return route.fulfill({ body: 'invalid image', contentType: 'image/webp' })
      return route.fulfill({ path: 'apps/web/public/icon-192.png', contentType: 'image/png' })
    })
  }
  await context.route('**/api/media/file/tile-calacatta-gold*.jpg', async route => {
    if (optimized && route.request().resourceType() === 'fetch') downloadedMedia.push(route.request().url().split('55177')[1])
    if (imageBlocked && !optimized && route.request().url().endsWith('-1.jpg')) return route.fulfill({status:503})
    return route.fulfill({path: 'apps/web/public/api/media/file/tile-calacatta-gold.jpg', contentType: 'image/jpeg'})
  })
  async function sha(body) {
    return page.evaluate(async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join(''), body)
  }
  const recovery = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll('script[type=module][src]')].map(script => script.src)
    const bundles = await Promise.all(urls.map(url => fetch(url).then(response => response.text())))
    return bundles.some(bundle => bundle.includes('بررسی حجم بستهٔ آفلاین'))
  })
  const dimensions = [{id:1,name:'60×120',width:60,height:120,slug:'60-120',createdAt:ts,updatedAt:ts}]
  const manifestData = { products:Object.fromEntries(records.map(record => [record.id, record])), dimensions, qr:{2:qr},
    activity:[activity.order,activity.supply],orders:{7:order},supplies:{7:supply},
    plans:[{id:'1',title:'Offline plan',startsAt:ts}],profile:{name:user.fullName,storeName:'',phone:user.phone,documents:[{id:'1',documentType:'business_license',status:'approved'}]} }
  if (optimized) {
    manifestData.products[2] = { ...records[1], cover: compactCover, gallery: records[1].gallery.slice(1) }
    manifestData.mediaPaths = { [records[1].cover.url]: compactCover }
    manifestData.orders[7] = { ...order, items: [{ ...order.items[0], product: {
      id: 2, name: 'Offline target', sku: 'PP-2', slug: 'p2', cover: compactCover,
    } }] }
    manifestData.activity = [{ ...activity.order, productImages: [compactCover] }, activity.supply]
  }
  let manifest, gzip
  if (recovery) {
    const image = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch('/api/media/file/tile-calacatta-gold.jpg')).arrayBuffer())))
    const imageHash = await sha(image)
    let coverAsset
    if (optimized) {
      compactBlocked = false
      coverAsset = await page.evaluate(async path => Array.from(new Uint8Array(await (await fetch(path)).arrayBuffer())), compactCover)
      compactBlocked = true
      downloadedMedia.length = 0
    }
    const raw = await page.evaluate(data => Array.from(new TextEncoder().encode(JSON.stringify(data))), manifestData)
    const compressed = await page.evaluate(async raw => Array.from(new Uint8Array(await new Response(new Blob([new Uint8Array(raw)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())), raw)
    gzip = await page.evaluate(bytes => btoa(String.fromCharCode(...bytes)), compressed)
    manifest = {id:'62372dac-6fea-47d6-9e55-4cfcd738a466',scopeKey:'test-scope',version:'fixture',format:1,
      capturedAt:Date.now(),expiresAt:Date.now()+86400000,dataHash:await sha(raw),dataBytes:raw.length,compressedBytes:compressed.length,
      counts:{products:2,activity:2,plans:1,qr:1},media:[{path:'/api/media/file/tile-calacatta-gold.jpg',hash:imageHash,bytes:image.length},
      {path:'/api/media/file/tile-calacatta-gold-1.jpg',hash:imageHash,bytes:image.length}]}
    if (optimized) {
      manifest.optimizedMedia = true
      manifest.media[1] = { path: compactCover, hash: await sha(coverAsset), bytes: coverAsset.length }
    }
  }
  let snapshotRequests = 0
  await context.route('**/api/rpc/**', async route => {
    const req = route.request()
    const url = req.url()
    const path = url.split('/api/rpc/')[1]
    const input = req.postDataJSON()?.json ?? {}
    let result
    switch (path) {
      case 'offline/manifest': result = manifest; break
      case 'offline/snapshot': snapshotRequests++; result = {gzip}; break
      case 'offline/status': result = {scopeKey:'test-scope',freshness:'upToDate'}; break
      case 'auth/session': result = {user,catalogScopeKey:'test-scope',offlineAccessUntil:Date.now()+86400000}; break
      case 'user/profile': result = user; break
      case 'catalog/facets': result = {scopeKey:'test-scope',dimensions:[{id:1,name:'60×120',width:60,height:120,slug:'60-120',createdAt:ts,updatedAt:ts}]}; break
      case 'catalog/syncPage': result = {scopeKey:'test-scope',items:[records[input.cursor ? 1 : 0]],nextCursor:input.cursor ? null : 'next',offlineQr:input.includeOfflineQr && input.cursor ? [{id:2,scanCode:qr}] : []}; break
      case 'catalog/getByIds': result = {scopeKey:'test-scope',items:records.filter(record => input.ids.includes(record.id))}; break
      case 'catalog/browse': result = {scopeKey:'test-scope',items:optimized ? records : [records[0]],total:2,hasMore:false}; break
      case 'plan/list': result = {items:[{id:1,title:'Offline plan',startsAt:ts}],total:1,hasMore:false}; break
      case 'activityFeed/list': result = {items:input.filter === 'all' ? [activity.order,activity.supply] : [activity[input.filter]],nextCursor:null,hasMore:false}; break
      case 'order/getById': result = order; break
      case 'supplyRequest/detail': result = supply; break
      case 'auth/logout': result = {success:true}; break
      default: throw Error('Unexpected RPC ' + path)
    }
    await route.fulfill({json:{json:result}})
  })
  await page.evaluate(user => {
    localStorage.setItem('persianpart_token','fixture')
    localStorage.setItem('persianpart_auth',JSON.stringify({user}))
  },user)
  const assertGallery = async (target, filename) => {
    const gallery = target.getByRole('region', { name: 'تصاویر محصول' })
    await gallery.locator(`img[src$="/${filename}"]`).waitFor()
    await target.waitForFunction(filename => Array.from(document.querySelectorAll('.product-gallery img')).some(
      img => img.src.endsWith('/' + filename) && img.naturalWidth > 0
    ), filename)
    if (await gallery.locator('img').count() !== 1 || await gallery.getByRole('group', { name: 'انتخاب تصویر' }).count()) {
      throw Error('Expected exactly one gallery photo and no carousel thumbnails')
    }
  }
  await page.goto('http://localhost:55177/product')
  const coverOnly = page.getByRole('img', { name: 'First product', exact: true })
  await coverOnly.click()
  await page.getByRole('heading', { name: 'First product', exact: true, level: 2 }).waitFor()
  if (await page.getByRole('region', { name: 'تصاویر محصول' }).count()) throw Error('Cover-only product has a gallery')
  if (optimized) {
    await page.goto('http://localhost:55177/product')
    const card = page.getByRole('img', {name: 'Offline target', exact: true})
    await card.waitFor()
    await page.waitForFunction(() => Array.from(document.images).some(img => img.alt === 'Offline target' &&
      img.src.endsWith('-1.jpg') && img.naturalWidth > 0))
    compactBlocked = false
    await page.reload()
    await page.waitForFunction(path => Array.from(document.images).some(img => img.alt === 'Offline target' &&
      img.src.endsWith(path) && img.naturalWidth > 0), compactCover)
    compactBlocked = true
  }
  await page.goto('http://localhost:55177/account')
  await page.getByRole('button',{name:'برنامهٔ پرشین‌پارت نصب و به‌روزرسانی'}).click()
  await page.getByRole('dialog').getByRole('button',{name:recovery ? 'بررسی حجم بستهٔ آفلاین' : 'دانلود بستهٔ آفلاین'}).click()
  if (recovery) {
    if (snapshotRequests) throw Error('Package started before confirmation')
    downloadedMedia.length = 0
    await page.getByRole('button',{name:'تأیید و شروع دریافت'}).click()
    if (optimized) {
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('alert').filter({hasText:'دریافت بعضی تصاویر کامل نشد'}).waitFor({timeout:10000})
      await dialog.getByText('۱ از ۲ تصویر ذخیره شده است.', {exact: false}).waitFor()
      // A resumed download must re-fetch an already recorded entry if its cached bytes changed.
      await page.evaluate(async hash => {
        const cache = await caches.open('persianpart-offline-media-content-v1')
        const key = '/offline-media/' + hash
        if (!await cache.match(key)) throw Error('Expected a cached image in the unfinished download')
        await cache.put(key, new Response('corrupt cache entry', { headers: { 'Content-Type': 'image/jpeg' } }))
      }, manifest.media[0].hash)
      await page.reload()
      await page.getByRole('button',{name:'برنامهٔ پرشین‌پارت نصب و به‌روزرسانی'}).click()
      compactBlocked = false
      await page.getByRole('dialog').getByRole('button',{name:'ادامهٔ دانلود'}).click()
      await page.getByRole('dialog').getByRole('button',{name:'تأیید و شروع دریافت'}).click()
    }
    await page.getByRole('dialog').getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({timeout:10000})
  } else {
    await page.getByRole('dialog').getByRole('alert').filter({hasText:'دریافت بعضی تصاویر کامل نشد'}).waitFor({timeout:10000})
    await page.getByText('۱ از ۲ تصویر ذخیره شده است.',{exact:false}).waitFor()
    await page.reload()
    await page.getByRole('button',{name:'برنامهٔ پرشین‌پارت نصب و به‌روزرسانی'}).click()
    imageBlocked = false
    await page.getByRole('dialog').getByRole('button',{name:'ادامهٔ دانلود'}).click()
    await page.getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({timeout:10000})
  }
  if (optimized) {
    if (downloadedMedia.filter(path => path === manifest.media[0].path).length < 2) {
      throw Error('The corrupted cached gallery original was not fetched again')
    }
    if (downloadedMedia.includes('/api/media/file/tile-calacatta-gold-1.jpg') || !downloadedMedia.includes(compactCover)) {
      throw Error('Download used the cover original instead of its compact image')
    }
    // Verify and repair an installed package after the browser evicts one image.
    await page.evaluate(async hash => {
      const cache = await caches.open('persianpart-offline-media-content-v1')
      if (!await cache.delete('/offline-media/' + hash)) throw Error('Missing image before the repair test')
    }, manifest.media[1].hash)
    await page.getByRole('dialog').getByRole('button', { name: 'بستن پنجره' }).click()
    const offlineAccount = page.getByRole('region', { name: 'بستهٔ آفلاین' })
    await offlineAccount.getByRole('button', { name: 'بررسی بسته', exact: true }).click()
    await offlineAccount.getByText('۱ تصویر روی دستگاه پیدا نشد.', {exact: true}).waitFor()
    await offlineAccount.getByRole('button', { name: 'تکمیل فایل‌های آفلاین' }).click()
    await offlineAccount.getByText('آمادهٔ استفادهٔ آفلاین', {exact: false}).waitFor()
    await page.getByRole('button',{name:'برنامهٔ پرشین‌پارت نصب و به‌روزرسانی'}).click()

    // A new snapshot with bad media must leave the successfully installed package usable.
    manifest = { ...manifest, id: '65372dac-6fea-47d6-9e55-4cfcd738a466', version: 'bad-media',
      media: [manifest.media[0], { ...manifest.media[1], hash: '0'.repeat(64) }] }
    compactBlocked = true
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'به‌روزرسانی داده‌های آفلاین' }).click()
    await dialog.getByRole('button', { name: 'تأیید و شروع دریافت' }).click()
    await dialog.getByRole('alert').filter({ hasText: 'دریافت بعضی تصاویر کامل نشد' }).waitFor()
    await dialog.getByText('آمادهٔ استفادهٔ آفلاین', { exact: false }).waitFor()
  }
  await context.setOffline(true)
  const fresh = await context.newPage()
  const selectSaved = async () => {
    if (recovery) await fresh.getByRole('button',{name:'ادامه با داده‌های ذخیره‌شده'}).click()
  }
  await fresh.goto('http://localhost:55177/product?productId=2')
  await selectSaved()
  await fresh.getByText('Offline target',{exact:true}).first().waitFor()
  await assertGallery(fresh, 'tile-calacatta-gold.jpg')
  const photo = fresh.getByRole('button', { name: 'بزرگ‌نمایی تصویر ۱' })
  await photo.click()
  const viewer = fresh.getByRole('dialog', { name: 'نمایشگر تصاویر محصول' })
  const original = viewer.locator('img[src$="/tile-calacatta-gold.jpg"]')
  await original.waitFor()
  await fresh.waitForFunction(() => Array.from(document.querySelectorAll('.product-viewer__photo img'))
    .some(img => img.src.endsWith('/tile-calacatta-gold.jpg') && img.naturalWidth > 0))
  if (await viewer.getByRole('button', { name: 'تصویر بعدی' }).count()) throw Error('Single-photo viewer has navigation')
  await fresh.keyboard.press('Escape')
  await viewer.waitFor({ state: 'hidden' })
  await fresh.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'بزرگ‌نمایی تصویر ۱')
  await fresh.getByRole('button',{name:'دریافت QR محصول'}).click()
  await fresh.getByText(qr,{exact:true}).waitFor()
  const download = fresh.waitForEvent('download')
  await fresh.getByRole('button',{name:'دانلود SVG'}).click()
  if ((await download).suggestedFilename() !== 'product-PP-002-qr.svg') throw Error('QR SVG')
  const png = fresh.waitForEvent('download')
  await fresh.getByRole('button',{name:'دانلود PNG'}).click()
  if ((await png).suggestedFilename() !== 'product-PP-002-qr.png') throw Error('QR PNG')
  await fresh.goto('http://localhost:55177/product?q=PP-2&dimension=60%C3%97120')
  await selectSaved()
  await fresh.getByText('Offline target',{exact:true}).first().waitFor()
  if (optimized) await fresh.waitForFunction(path =>
    Array.from(document.images).some(img => img.src.endsWith(path) && img.naturalWidth > 0), compactCover)
  if (await fresh.getByText('First product',{exact:true}).count()) throw Error('Offline filter')
  await fresh.goto('http://localhost:55177/plans')
  await selectSaved()
  await fresh.getByText('Offline plan',{exact:true}).first().waitFor()
  await fresh.goto('http://localhost:55177/orders/7')
  await selectSaved()
  await fresh.getByText('Offline target',{exact:true}).first().waitFor()
  if (optimized) await fresh.waitForFunction(path =>
    Array.from(document.images).some(img => img.src.endsWith(path) && img.naturalWidth > 0), compactCover)
  await fresh.goto('http://localhost:55177/orders?requestId=7&view=supply')
  await selectSaved()
  await fresh.getByText('Offline supply detail',{exact:true}).waitFor()
  await fresh.goto('http://localhost:55177/account')
  await selectSaved()
  await fresh.getByText('پروانه کسب',{exact:true}).waitFor()
  await fresh.getByRole('button',{name:'برنامهٔ پرشین‌پارت نصب و به‌روزرسانی'}).click()
  await fresh.getByRole('dialog').getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor()
  await page.getByRole('dialog').getByRole('button',{name:'حذف داده‌های آفلاین'}).click()
  await fresh.getByRole('dialog').getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({state:'hidden'})
  await fresh.close()
  await context.setOffline(false)

  if (recovery) return
  await page.getByRole('button',{name:'دانلود بستهٔ آفلاین'}).click()
  await page.getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({timeout:10000})
  await page.evaluate(() => {
    localStorage.setItem('persianpart_token', 'other-account')
    localStorage.setItem('persianpart_auth', JSON.stringify({ user: { id: '2', name: 'Other tester' } }))
  })
  await context.setOffline(true)
  const other = await context.newPage()
  await other.goto('http://localhost:55177/orders/7')
  await other.getByText('برای دریافت این سفارش به اینترنت وصل شوید.',{exact:true}).waitFor()
  if (await other.getByText('Offline target',{exact:true}).count()) throw Error('Order leaked across accounts')
  await other.close()
  await context.setOffline(false)
}
