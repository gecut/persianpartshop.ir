import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { call } from '@orpc/server'

// Opt-in only: requires the disposable seeded CMS, never a production target.
const liveTest = process.env.WAREHOUSE_LIVE_TEST === 'true' ? test : test.skip
liveTest('live CMS: mixed quote, submit/replay, cancellation and 60-minute boundary', async () => {
  const target = new URL(process.env.CMS_API_URL!)
  expect(target.hostname).toBe('127.0.0.1')
  expect(target.port).toBe('55174')
  const { sdk } = await import('../payload')
  const { warehouse } = await import('./warehouse')
  const { order } = await import('./order')
  const customer = (await sdk.find({ collection: 'users', where: { status: { equals: 'active' } }, limit: 1 })).docs[0]!
  const tile = (await sdk.find({ collection: 'products', where: { productType: { equals: 'tile' } }, limit: 1 })).docs[0]!
  const bag = (await sdk.find({ collection: 'products', where: { sku: { equals: 'PP-DEMO-ADHESIVE' } }, limit: 1 })).docs[0]!
  const context = { user: { id: customer.id, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') }
  const items = [{ productId: tile.id, requestedArea: 1 }, { productId: bag.id, requestedArea: 2.2 }]
  const quote = await call(warehouse.availability, { items }, { context })
  expect(quote.items.find(item => item.productId === bag.id)).toMatchObject({ productType: 'other', unit: 'bag', deliverableArea: 3 })
  const warehouseId = quote.warehouses[0]!.id
  const balances = () => sdk.find({ collection: 'warehouse-stock', where: { and: [{ warehouse: { equals: warehouseId } }, { product: { in: [tile.id, bag.id] } }] }, depth: 0, sort: 'product', limit: 100 })
  const before = (await balances()).docs.map(balance => balance.inventorySqm)
  const input = { warehouseId, items, idempotencyKey: randomUUID() }
  const created = await call(order.submit, input, { context })
  expect(created.finalTotal).toBe(quote.items.reduce((sum, item) => sum + item.totalPrice, 0))
  expect(created.items.find(item => item.unit === 'bag')?.salesFactor).toBe(1)
  const after = (await balances()).docs.map(balance => balance.inventorySqm)
  expect(after).not.toEqual(before)
  expect((await call(order.submit, input, { context })).id).toBe(created.id)
  expect((await balances()).docs.map(balance => balance.inventorySqm)).toEqual(after)
  await call(order.cancel, { id: created.id }, { context })
  await call(order.cancel, { id: created.id }, { context })
  expect((await balances()).docs.map(balance => balance.inventorySqm)).toEqual(before)
  const old = await sdk.create({ collection: 'orders', data: { trackingNumber: 0, user: customer.id, warehouse: warehouseId, status: 'pending', orderNumber: `boundary-${randomUUID()}`, items: [{ product: bag.id, requestedArea: 1, cartonCount: 0, deliverableArea: 0, unitPrice: 0, totalPrice: 0 }], subtotal: 0, finalTotal: 0, createdAt: new Date(Date.now() - 61 * 60_000).toISOString() } })
  await expect(call(order.cancel, { id: old.id }, { context })).rejects.toHaveProperty('code', 'CANCELLATION_DEADLINE_EXPIRED')
  await sdk.update({ collection: 'orders', id: old.id, data: { status: 'cancelled_by_admin' } })
  expect((await balances()).docs.map(balance => balance.inventorySqm)).toEqual(before)
})

liveTest('live CMS: shopping endpoints preserve category and hidden-stock permissions', async () => {
  const target = new URL(process.env.CMS_API_URL!)
  expect(target.hostname).toBe('127.0.0.1')
  expect(target.port).toBe('55174')
  const { sdk } = await import('../payload')
  const { shopping } = await import('./shopping')
  const { catalog } = await import('./catalog')
  const { warehouse } = await import('./warehouse')
  const customer = (await sdk.find({ collection: 'users', where: { status: { equals: 'active' } }, limit: 1, depth: 0 })).docs[0]!
  const tile = (await sdk.find({ collection: 'products', where: { productType: { equals: 'tile' } }, limit: 1, depth: 0 })).docs[0]!
  const category = (await sdk.find({ collection: 'categories', where: { id: { not_equals: tile.category } }, limit: 1 })).docs[0]!
  const context = { user: { id: customer.id, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') }
  try {
    await sdk.update({ collection: 'users', id: customer.id, data: { hideExactStock: true } })
    const hidden = await call(shopping.detail, { id: tile.id }, { context })
    expect(hidden.hideExactStock).toBe(true)
    expect(hidden.inventorySqm).toBe(1)
    expect(JSON.stringify(hidden)).not.toContain('basePricePerSqm')
    await expect(call(warehouse.availability, { items: [{ productId: tile.id, requestedArea: 1 }] }, { context })).rejects.toHaveProperty('code', 'FORBIDDEN')
    await sdk.update({ collection: 'users', id: customer.id, data: { hideExactStock: false, allowedCategories: [category.id] } })
    expect(await call(shopping.detail, { id: tile.id }, { context })).toBeNull()
    expect(await call(shopping.cartProducts, [tile.id], { context })).toEqual([])
    expect((await call(shopping.all, { categoryId: Number(tile.category) }, { context })).docs).toEqual([])
    await expect(call(catalog.getById, { id: String(tile.id) }, { context })).rejects.toHaveProperty('code', 'NOT_FOUND')
    await expect(call(shopping.calculateCartons, { productId: String(tile.id), requestedArea: 1 }, { context })).rejects.toHaveProperty('code', 'NOT_FOUND')
  } finally {
    await sdk.update({ collection: 'users', id: customer.id, data: { hideExactStock: customer.hideExactStock, disableOrdering: customer.disableOrdering, allowedCategories: (customer.allowedCategories ?? []).map(category => typeof category === 'object' ? category.id : category) } })
  }
})

const httpTest = process.env.WAREHOUSE_HTTP_TEST === 'true' ? test : test.skip
httpTest('live HTTP: signed customer session quotes through Hono and anonymous access is denied', async () => {
  const cms = new URL(process.env.CMS_API_URL!)
  expect(cms.origin).toBe('http://127.0.0.1:55174')
  const { sdk } = await import('../payload')
  const { generateToken } = await import('../lib/jwt')
  const customer = (await sdk.find({ collection: 'users', where: { status: { equals: 'active' } }, limit: 1 })).docs[0]!
  const product = (await sdk.find({ collection: 'products', where: { sku: { equals: 'PP-DEMO-ADHESIVE' } }, limit: 1 })).docs[0]!
  const token = await generateToken({ id: customer.id, role: 'customer' })
  const request = (authenticated: boolean) => fetch('http://127.0.0.1:55175/api/rpc/warehouse/availability', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ json: { items: [{ productId: product.id, requestedArea: 2.2 }] } }),
  })
  const response = await request(true)
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toMatchObject({ json: { items: [{ unit: 'bag', deliverableArea: 3 }] } })
  expect((await request(false)).status).toBe(401)
})
