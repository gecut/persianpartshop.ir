import { describe, expect, test } from 'bun:test'
import type { CustomerOrderDocument } from '@persianpart/contract'
import { mapDocToOrder } from './order-mapper'

const doc: CustomerOrderDocument = {
  id: 1,
  orderNumber: '1405090317',
  status: 'pending',
  warehouse: 1,
  user: {
    id: 1,
    fullName: 'رضا محمدی',
    phone: '09121234567',
  },
  items: [
    {
      product: 7,
      productName: 'کاشی',
      requestedArea: 40,
      cartonCount: 28,
      deliverableArea: 40.32,
      unitPrice: 485000,
      totalPrice: 19555200,
    },
  ],
  subtotal: 19555200,
  finalTotal: 19555200,
  createdAt: '2026-11-24T09:42:00.000Z',
  updatedAt: '2026-11-24T09:42:00.000Z',
}

describe('mapDocToOrder', () => {
  test('copies item quantities verbatim', () => {
    expect(mapDocToOrder(doc).items[0]).toMatchObject({
      cartonCount: 28,
      deliverableArea: 40.32,
      requestedArea: 40,
      unitPrice: 485000,
      totalPrice: 19555200,
    })
  })

  test('empty company name stays empty', () => expect(mapDocToOrder(doc).storeName).toBe(''))

  test('null tax/discount become 0', () =>
    expect(mapDocToOrder({ ...doc, taxAmount: null, discountAmount: null })).toMatchObject({
      taxAmount: 0,
      discountAmount: 0,
    }))

  test('finalTotal 0 is kept, not replaced by subtotal', () =>
    expect(mapDocToOrder({ ...doc, finalTotal: 0 }).finalTotal).toBe(0))

  test('missing notes become empty string', () =>
    expect(mapDocToOrder({ ...doc, notes: null }).notes).toBe(''))
})
