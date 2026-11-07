import { createHash } from 'node:crypto'
import { describe, test, expect, mock } from 'bun:test'
import { call } from '@orpc/server'
let stock = [1000, 100]
let existingOrder: Record<string, unknown> | null = null
let permissions: Record<string, unknown> = {}
let lookupFailure = false
const product = { productType: 'tile' as 'tile' | 'other', unit: 'bag', category: 1, id: 1, name: 'کاشی', sku: 'T1', isActive: true, sqmPerCarton: 1.44, basePricePerSqm: 100 }
mock.module('../payload', () => ({ sdk: {
  find: async (input: { collection: string }) => {
    if (input.collection === 'orders') return { docs: existingOrder ? [existingOrder] : [] }
    if (input.collection === 'products') return { docs: [product] }
    if (input.collection === 'warehouses') return { docs: [{ id: 1, name: 'اول', code: 'W1' }, { id: 2, name: 'دوم', code: 'W2' }], hasNextPage: false }
    if (input.collection === 'warehouse-stock') return { docs: stock.map((amount, index) => ({ product: 1, warehouse: index + 1, inventorySqm: amount })), hasNextPage: false }
    return { docs: [] }
  },
  findByID: async () => { if (lookupFailure) throw new Error('offline'); return { customerType: { markupPercent: 10 }, ...permissions } },
} }))
const { warehouse } = await import('./warehouse')
const context = { user: { id: 1, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') }
const quote = (requestedArea: number) => call(warehouse.availability, { items: [{ productId: 1, requestedArea }] }, { context })
describe('single warehouse eligibility', () => {
  test('one, multiple and zero candidates without pooling stock', async () => {
    stock = [1000, 100]
    expect((await quote(500)).warehouses.map(item => item.id)).toEqual([1])
    expect((await quote(50)).warehouses.map(item => item.id)).toEqual([1, 2])
    stock = [60, 60]
    expect((await quote(100)).warehouses).toEqual([])
  })
  test('full carton rounding and final customer prices', async () => {
    stock = [100, 0]
    const result = await quote(99.9)
    expect(result.items[0]?.deliverableArea).toBe(100.8)
    expect(result.items[0]?.unitPrice).toBe(110)
    expect(result.warehouses).toEqual([])
    expect(JSON.stringify(result)).not.toContain('basePricePerSqm')
  })
  test('anonymous reads require authentication', async () => {
    await expect(call(warehouse.availability, { items: [{ productId: 1, requestedArea: 1 }] }, { context: { ...context, user: null } })).rejects.toThrow()
  })
})

const { order } = await import('./order')
test('same idempotent submit replays, different warehouse conflicts, custom orders stop', async () => {
  existingOrder = {
    id: 8, orderNumber: 'ptp 8', user: 1, warehouse: 1, status: 'pending', notes: '',
    subtotal: 1008, finalTotal: 1008, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    items: [{ product: 1, requestedArea: 10, cartonCount: 7, deliverableArea: 10.08, unitPrice: 100, totalPrice: 1008 }],
    requestFingerprint: createHash('sha256').update(JSON.stringify({ warehouseId: 1, items: [[1, 10]], notes: '', deliveryAddress: null })).digest('hex'),
  }
  const input = { warehouseId: 1, items: [{ productId: 1, requestedArea: 10 }], idempotencyKey: 'retry-key' }
  expect((await call(order.submit, input, { context })).id).toBe(8)
  try {
    await call(order.submit, { ...input, warehouseId: 2 }, { context })
    throw new Error('expected conflict')
  } catch (error) { expect(error).toHaveProperty('code', 'CONFLICT') }
  await expect(call(order.createCustomOrder, {}, { context })).rejects.toThrow('ثبت سفارش اختصاصی فعلاً فعال نیست.')
  existingOrder = null
})

test('non-tile units ignore legacy carton metadata and round to whole selling units', async () => {
  product.productType = 'other'
  stock = [3, 0]
  const result = await quote(2.2)
  expect(result.items[0]).toMatchObject({ cartonCount: 3, deliverableArea: 3, sqmPerCarton: 1, productType: 'other', unit: 'bag', totalPrice: 330 })
  expect(result.warehouses.map(item => item.id)).toEqual([1])
  product.productType = 'tile'
})

test('category restrictions, catalog-only flags and permission lookup errors fail closed', async () => {
  for (const restriction of [{ allowedCategories: [2] }, { hideExactStock: true }, { disableOrdering: true }]) {
    permissions = restriction
    await expect(quote(1)).rejects.toHaveProperty('code', 'FORBIDDEN')
  }
  permissions = {}
  lookupFailure = true
  await expect(quote(1)).rejects.toHaveProperty('code', 'SERVICE_UNAVAILABLE')
  lookupFailure = false
})
