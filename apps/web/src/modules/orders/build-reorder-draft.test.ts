import { describe, expect, test } from 'bun:test'
import type { Order } from '@/modules/orders/order-types'
import type { Product } from '@/modules/products/product-types'
import { buildReorderDraft } from './build-reorder-draft'

const item = (overrides: Partial<Order['items'][number]>): Order['items'][number] => ({
  productId: '7',
  productSku: 'SKU-7',
  productName: 'کالای حذف‌شده',
  unitPrice: 1000,
  deliverableArea: 2,
  ...overrides,
}) as Order['items'][number]

describe('buildReorderDraft', () => {
  test('returns an empty draft without items', () => {
    expect(buildReorderDraft(undefined, [])).toEqual({ reorderProducts: [], reorderQuantities: {} })
  })

  test('prefers the current catalog product', () => {
    const catalog = { id: '7', sku: 'SKU-7', name: 'کاتالوگ' } as Product
    const draft = buildReorderDraft([item({ requestedArea: 3 })], [catalog])
    expect(draft.reorderProducts[0]).toBe(catalog)
    expect(draft.reorderQuantities).toEqual({ '7': 3 })
  })

  test('keeps product type and unit for an item missing from the catalog', () => {
    const draft = buildReorderDraft([item({ productType: 'other', unit: 'عدد' })], [])
    expect(draft.reorderProducts[0]).toMatchObject({ id: '7', slug: '7', productType: 'other', unit: 'عدد' })
    expect(draft.reorderQuantities).toEqual({ '7': 2 })
  })

  test('falls back to a tile when the stored type is not other', () => {
    expect(buildReorderDraft([item({})], []).reorderProducts[0]?.productType).toBe('tile')
  })
})
