import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { call } from '@orpc/server'
import type { Product } from '@persianpart/cms/types'
import type { Context } from '../rpc/context'

let permission = true
let categories: number[] = []
const product: Product = { id: 1, name: 'Catalog fixture', sku: 'P1', slug: 'p1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', isActive: true, productType: 'tile', sqmPerCarton: 1, scanCode: 'PP-001', basePricePerSqm: 100, inventorySqm: 10, stockCartons: 10 }
let captured: Record<string, unknown> | undefined
let pageDocs: Product[] = [product]
mock.module('../payload', () => ({ sdk: {
  findByID: async () => ({ id: 1, customerType: { markupPercent: 10 }, canUseProductQr: permission, allowedCategories: categories }),
  find: async (input: Record<string, unknown>) => {
    if (input.collection === 'products') { captured = input; return { docs: pageDocs, hasNextPage: false } }
    if (input.collection === 'warehouse-stock') return { docs: [], hasNextPage: false }
    return { docs: [], hasNextPage: false }
  },
} }))
const { catalogSync, catalogRecord, catalogScope } = await import('./catalog-sync')
const context = (): Context => ({ user: { id: 1, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') })
beforeEach(() => { permission = true; categories = []; pageDocs = [product]; captured = undefined })
describe('typed shared catalog boundary', () => {
  test('only authorized customers receive a hash, never raw codes or base prices', async () => {
    const ctx = context(), scope = await catalogScope(ctx)
    const result = catalogRecord({ ...product, availability: 'available' } as Product, ctx, scope)
    expect(result.scanHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.finalCustomerPricePerSqm).toBe(110)
    expect(result).not.toHaveProperty('scanCode')
    expect(result).not.toHaveProperty('basePricePerSqm')
    expect(catalogRecord({ ...product, availability: 'available' } as Product, { ...ctx, user: { id: 1, role: 'admin' } }, scope).scanHash).toBeUndefined()
    permission = false
    expect(catalogRecord({ ...product, availability: 'available' } as Product, ctx, await catalogScope(ctx)).scanHash).toBeUndefined()
  })
  test('scope changes with category, price visibility or QR permission', async () => {
    const ctx = context(), original = await catalogScope(ctx)
    categories = [3]
    expect((await catalogScope(ctx)).scopeKey).not.toBe(original.scopeKey)
    categories = []; permission = false
    expect((await catalogScope(ctx)).scopeKey).not.toBe(original.scopeKey)
  })
  test('stable cursors carry the watermark and reject a changed scope without data', async () => {
    const ctx = context()
    pageDocs = [product, { ...product, id: 2 }]
    const first = await call(catalogSync.syncPage, { limit: 1 }, { context: ctx })
    expect(first.items).toHaveLength(1)
    expect(first.nextCursor).toBeString()
    const cursor = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString())
    expect(cursor).toMatchObject({ id: 1, createdAt: product.createdAt, scopeKey: first.scopeKey })
    pageDocs = []
    await call(catalogSync.syncPage, { limit: 1, cursor: first.nextCursor! }, { context: ctx })
    expect(JSON.stringify(captured?.where)).toContain(cursor.watermark)
    expect(JSON.stringify(captured?.where)).toContain('less_than')
    permission = false
    const changed = await call(catalogSync.syncPage, { limit: 1, cursor: first.nextCursor! }, { context: ctx })
    expect(changed.items).toHaveLength(0)
    expect(changed.scopeKey).not.toBe(first.scopeKey)
  })
  test('malformed cursors and oversized grouped requests fail validation', async () => {
    await expect(call(catalogSync.syncPage, { cursor: 'invalid', limit: 24 }, { context: context() })).rejects.toHaveProperty('code', 'BAD_REQUEST')
    await expect(call(catalogSync.getByIds, { ids: Array.from({ length: 101 }, (_, i) => i + 1) }, { context: context() })).rejects.toThrow()
  })
  test('shared customer cache endpoints reject expired or missing identities', async () => {
    const anonymous = { ...context(), user: null }
    await expect(call(catalogSync.syncPage, { limit: 24 }, { context: anonymous })).rejects.toHaveProperty('code', 'UNAUTHORIZED')
    await expect(call(catalogSync.getByIds, { ids: [1] }, { context: anonymous })).rejects.toHaveProperty('code', 'UNAUTHORIZED')
  })
})
