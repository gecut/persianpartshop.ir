import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { call } from '@orpc/server'

let permissions: Record<string, unknown> = {}
let failPermissions = false
let product: Record<string, unknown> | null = null
mock.module('../payload', () => ({ sdk: {
  findByID: async ({ collection }: { collection: string }) => {
    if (collection === 'users') {
      if (failPermissions) throw new Error('offline')
      return { customerType: { markupPercent: 10 }, ...permissions }
    }
    if (collection === 'plans') return { id: 9, title: 'Plan', users: [1], products: [product], isActive: true }
    return product
  },
  find: async ({ collection, where }: { collection: string; where?: Record<string, { equals: unknown }> }) => {
    if (collection === 'warehouse-stock') return { docs: [{ product: 501, inventorySqm: 15 }], hasNextPage: false }
    if (collection === 'plans') return { docs: [{ id: 9, title: 'Plan', users: [1], products: [product], isActive: true }], totalDocs: 1 }
    if (collection === 'orders') return { docs: [{ id: 7, items: [{ product }] }], totalDocs: 1 }
    if (collection === 'products') {
      const matches = product && Object.entries(where ?? {}).every(([key, condition]) => product?.[key] === condition.equals)
      return { docs: matches ? [product] : [], hasNextPage: false }
    }
    return { docs: [], hasNextPage: false }
  },
} }))
const { catalog } = await import('./catalog')
const { plan } = await import('./plan')
const { order } = await import('./order')
const context = { user: { id: 1, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') }
const scan = (scanCode: string) => call(catalog.getByScanCode, { scanCode }, { context })
const getQr = () => call(catalog.getProductQr, { id: 501 }, { context })

beforeEach(() => {
  permissions = { canUseProductQr: true }
  failPermissions = false
  product = { id: 501, name: 'Tile', slug: 'tile', sku: 'SKU', scanCode: 'PP-001', category: 3, isActive: true, productType: 'tile', sqmPerCarton: 1, basePricePerSqm: 100, cover: { id: 3, url: '/cover.png' }, gallery: [{ image: { id: 4, url: '/gallery.png' } }] }
})

describe('product QR authorization and lookup', () => {
  test('normalizes scan code, returns customer price and stock, and creates a QR payload', async () => {
    const result = await scan('  pp-001  ')
    expect(result).toMatchObject({ id: 501, finalCustomerPricePerSqm: 110, inventorySqm: 15 })
    expect(result).not.toHaveProperty('basePricePerSqm')
    expect(result).not.toHaveProperty('scanCode')
    expect(result.hasScanCode).toBe(true)
    expect(result.cover).toMatchObject({ url: '/cover.png' })
    expect(result.gallery?.[0]?.image).toMatchObject({ url: '/gallery.png' })
    expect(await getQr()).toEqual({ scanCode: 'PP-001' })
  })
  test('requires a signed-in user and a current permission for both operations', async () => {
    await expect(call(catalog.getByScanCode, { scanCode: 'PP-001' }, { context: { ...context, user: null } })).rejects.toHaveProperty('code', 'UNAUTHORIZED')
    await expect(call(catalog.getByScanCode, { scanCode: 'PP-001' }, { context: { ...context, user: { ...context.user, role: 'admin' } } })).rejects.toHaveProperty('code', 'FORBIDDEN')
    permissions.canUseProductQr = false
    await expect(scan('PP-001')).rejects.toHaveProperty('code', 'FORBIDDEN')
    await expect(getQr()).rejects.toHaveProperty('code', 'FORBIDDEN')
    failPermissions = true
    await expect(scan('PP-001')).rejects.toHaveProperty('code', 'SERVICE_UNAVAILABLE')
  })
  test('enforces category access, active status, exact lookup, and length', async () => {
    permissions.allowedCategories = [4]
    await expect(scan('PP-001')).rejects.toHaveProperty('code', 'NOT_FOUND')
    await expect(getQr()).rejects.toHaveProperty('code', 'NOT_FOUND')
    permissions.allowedCategories = [3]
    await expect(scan('PP-00')).rejects.toHaveProperty('code', 'NOT_FOUND')
    product!.isActive = false
    await expect(scan('PP-001')).rejects.toHaveProperty('code', 'NOT_FOUND')
    product!.isActive = true
    product!.scanCode = 'A'.repeat(128)
    expect((await scan('A'.repeat(128))).id).toBe(501)
    await expect(scan('A'.repeat(129))).rejects.toThrow()
  })
  test('hides exact stock and omits QR for an unregistered code', async () => {
    permissions.hideExactStock = true
    expect(await scan('PP-001')).toMatchObject({ inventorySqm: 1, stockCartons: 1, hideExactStock: true })
    product!.scanCode = null
    await expect(getQr()).rejects.toHaveProperty('code', 'NOT_FOUND')
  })
  test('does not leak a scan code through populated plans or orders', async () => {
    permissions.canUseProductQr = false
    const responses = [
      await call(plan.list, {}, { context }),
      await call(plan.getById, { id: 9 }, { context }),
      await call(order.all, {}, { context }),
      await call(order.list, {}, { context }),
    ]
    for (const response of responses) {
      expect(JSON.stringify(response)).toContain('Tile')
      expect(JSON.stringify(response)).not.toContain('PP-001')
      expect(JSON.stringify(response)).not.toContain('scanCode')
    }
  })
  test('rejects malformed scan responses instead of returning invalid product data', async () => {
    product!.sku = null
    await expect(scan('PP-001')).rejects.toThrow()
    product!.sku = 'SKU'
    product!.basePricePerSqm = -100
    await expect(scan('PP-001')).rejects.toThrow()
  })
})
