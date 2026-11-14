async page => {
  const context = page.context()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  const ts = '2026-01-01T00:00:00.000Z'
  const qr = 'PP-002'
  const scanHash = await page.evaluate(async code => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))), n => n.toString(16).padStart(2, '0')).join(''), qr)
  const records = [
    { id: 1, name: 'First product', sku: 'PP-1', slug: 'p1', createdAt: ts, inventorySqm: 1, stockCartons: 1, availability: 'available', finalCustomerPricePerSqm: 100, hasScanCode: false, cover: { url: '/api/media/file/tile-calacatta-gold.jpg' } },
    { id: 2, name: 'Offline target', sku: 'PP-2', slug: 'p2', createdAt: ts, inventorySqm: 1, stockCartons: 1, availability: 'available', finalCustomerPricePerSqm: 200, hasScanCode: true, scanHash, dimension: {id:1,name:'60×120',width:60,height:120}, cover: { url: '/api/media/file/tile-calacatta-gold-1.jpg' } },
  ]
  const user = { id: '1', fullName: 'Offline Tester', name: 'Offline Tester', phone: '09120000000', canUseProductQr: true, documents: [{id:'1',documentType:'business_license',status:'approved',file:{url:'/private-file.png'}}] }
  const order = {id:7,orderNumber:'1234567',status:'pending',warehouse:1,user:1,items:[{product:2,productName:'Offline target',requestedArea:1,cartonCount:1,deliverableArea:1,unitPrice:200,totalPrice:200}],subtotal:200,finalTotal:200,createdAt:ts,updatedAt:ts}
  const supply = {id:7,requestNumber:'1234568',status:'new',productId:2,productName:'Offline target',productSku:'PP-2',productImage:null,warehouseId:null,warehouseName:null,warehouseCode:null,productType:'tile',unit:'m2',requestedQuantity:1,packageCount:1,roundedQuantity:1,salesFactor:1,cartonsPerPallet:null,estimatedUnitPrice:200,estimatedTotal:200,notes:'Offline supply detail',createdAt:ts,updatedAt:ts,responseDueAt:ts,reviewStartedAt:null,resolvedAt:null,cancelledAt:null,canCancel:true,isOverdue:true}
  const activity = { order:{kind:'order',id:7,orderNumber:'1234567',status:'pending',statusLabel:'ثبت‌شده',createdAt:ts,totalAmount:200,itemCount:1,quantitySummary:'1',productImages:[],canReorder:true}, supply:{kind:'supply',id:7,requestNumber:'1234568',status:'new',statusLabel:'ثبت‌شده',createdAt:ts,estimatedTotal:200,productName:'Offline target',productImage:null,requestedQuantity:1,roundedQuantity:1,unit:'m2',packageCount:1,cartonsPerPallet:null,responseDueAt:ts,canCancel:true,isOverdue:true}}
  let imageBlocked = true
  await context.route('**/api/media/file/tile-calacatta-gold*.jpg', async route => {
    if (imageBlocked && route.request().url().endsWith('-1.jpg')) return route.fulfill({status:503})
    return route.fulfill({path: 'apps/web/public/api/media/file/tile-calacatta-gold.jpg', contentType: 'image/jpeg'})
  })
  async function sha(body) {
    return page.evaluate(async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join(''), body)
  }
  const recovery = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll('script[type=module][src]')].map(script => script.src)
    const bundles = await Promise.all(urls.map(url => fetch(url).then(response => response.text())))
    return bundles.some(bundle => bundle.includes('تأیید و شروع دریافت'))
  })
  const dimensions = [{id:1,name:'60×120',width:60,height:120,slug:'60-120',createdAt:ts,updatedAt:ts}]
  const manifestData = { products:Object.fromEntries(records.map(record => [record.id, record])), dimensions, qr:{2:qr},
    activity:[activity.order,activity.supply],orders:{7:order},supplies:{7:supply},
    plans:[{id:'1',title:'Offline plan',startsAt:ts}],profile:{name:user.fullName,storeName:'',phone:user.phone,documents:[{id:'1',documentType:'business_license',status:'approved'}]} }
  let manifest, gzip
  if (recovery) {
    const image = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch('/api/media/file/tile-calacatta-gold.jpg')).arrayBuffer())))
    const imageHash = await sha(image)
    const raw = await page.evaluate(data => Array.from(new TextEncoder().encode(JSON.stringify(data))), manifestData)
    const compressed = await page.evaluate(async raw => Array.from(new Uint8Array(await new Response(new Blob([new Uint8Array(raw)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())), raw)
    gzip = await page.evaluate(bytes => btoa(String.fromCharCode(...bytes)), compressed)
    manifest = {id:'62372dac-6fea-47d6-9e55-4cfcd738a466',scopeKey:'test-scope',version:'fixture',format:1,
      capturedAt:Date.now(),expiresAt:Date.now()+86400000,dataHash:await sha(raw),dataBytes:raw.length,compressedBytes:compressed.length,
      counts:{products:2,activity:2,plans:1,qr:1},media:[{path:'/api/media/file/tile-calacatta-gold.jpg',hash:imageHash,bytes:image.length},
      {path:'/api/media/file/tile-calacatta-gold-1.jpg',hash:imageHash,bytes:image.length}]}
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
      case 'catalog/browse': result = {scopeKey:'test-scope',items:[records[0]],total:2,hasMore:false}; break
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
  await page.goto('http://localhost:55177/account')
  await page.getByRole('button',{name:'نصب و به‌روزرسانی برنامه'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'آماده‌سازی برای استفادهٔ آفلاین'}).click()
  if (recovery) {
    if (snapshotRequests) throw Error('Package started before confirmation')
    await page.getByRole('button',{name:'تأیید و شروع دریافت'}).click()
    await page.getByRole('dialog').getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({timeout:10000})
  } else {
    await page.getByRole('alert').filter({hasText:'دریافت بعضی تصاویر کامل نشد'}).waitFor({timeout:10000})
    await page.getByText('۱ از ۲ تصویر ذخیره شده است.',{exact:false}).waitFor()
    await page.reload()
    await page.getByRole('button',{name:'نصب و به‌روزرسانی برنامه'}).click()
    imageBlocked = false
    await page.getByRole('button',{name:'ادامهٔ دانلود'}).click()
    await page.getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({timeout:10000})
  }
  await context.setOffline(true)
  const fresh = await context.newPage()
  const selectSaved = async () => {
    if (recovery) await fresh.getByRole('button',{name:'ادامه با داده‌های ذخیره‌شده'}).click()
  }
  await fresh.goto('http://localhost:55177/product?productId=2')
  await selectSaved()
  await fresh.getByText('Offline target',{exact:true}).first().waitFor()
  await fresh.waitForFunction(() => [...document.images].some(img => img.src.endsWith('tile-calacatta-gold-1.jpg') && img.complete && img.naturalWidth > 0))
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
  if (await fresh.getByText('First product',{exact:true}).count()) throw Error('Offline filter')
  await fresh.goto('http://localhost:55177/plans')
  await selectSaved()
  await fresh.getByText('Offline plan',{exact:true}).first().waitFor()
  await fresh.goto('http://localhost:55177/orders/7')
  await selectSaved()
  await fresh.getByText('Offline target',{exact:true}).first().waitFor()
  await fresh.goto('http://localhost:55177/orders?requestId=7&view=supply')
  await selectSaved()
  await fresh.getByText('Offline supply detail',{exact:true}).waitFor()
  await fresh.goto('http://localhost:55177/account')
  await selectSaved()
  await fresh.getByText('پروانه کسب',{exact:true}).waitFor()
  await fresh.getByRole('button',{name:'نصب و به‌روزرسانی برنامه'}).click()
  await fresh.getByRole('dialog').getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor()
  await page.getByRole('dialog').getByRole('button',{name:'حذف داده‌های آفلاین'}).click()
  await fresh.getByRole('dialog').getByText('آمادهٔ استفادهٔ آفلاین',{exact:false}).waitFor({state:'hidden'})
  await fresh.close()
  await context.setOffline(false)

  if (recovery) return
  await page.getByRole('button',{name:'آماده‌سازی برای استفادهٔ آفلاین'}).click()
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
