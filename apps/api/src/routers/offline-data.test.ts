import { describe, expect, test } from 'bun:test'
import type { OfflineSnapshot } from '@persianpart/contract'
import { structuralOfflineData } from './offline-data'

function createOfflineSnapshot(familyId: number | null): OfflineSnapshot {
  return {
    products: {
      '101': {
        id: 101,
        sku: 'SKU-001',
        name: 'کالای تستی',
        slug: 'test-product',
        createdAt: '2026-11-21T00:00:00.000Z',
        inventorySqm: 50,
        stockCartons: 10,
        availability: 'available',
        matchesInStockFilter: true,
        finalCustomerPricePerSqm: 300000,
        hasScanCode: false,
        familyId,
      },
    },
    dimensions: [],
    qr: {},
    activity: [],
    orders: {},
    supplies: {},
    plans: [],
    profile: {
      name: 'کاربر تست',
      storeName: 'فروشگاه تست',
      phone: '09120000000',
      documents: [],
    },
  }
}

describe('structuralOfflineData product family preservation', () => {
  test('output changes when only a product familyId changes', () => {
    const snapshotA = createOfflineSnapshot(7)
    const snapshotB = createOfflineSnapshot(8)
    const snapshotC = createOfflineSnapshot(null)

    const structuralA = structuralOfflineData(snapshotA)
    const structuralB = structuralOfflineData(snapshotB)
    const structuralC = structuralOfflineData(snapshotC)

    expect(JSON.stringify(structuralA)).not.toEqual(JSON.stringify(structuralB))
    expect(JSON.stringify(structuralA)).not.toEqual(JSON.stringify(structuralC))
    expect(JSON.stringify(structuralB)).not.toEqual(JSON.stringify(structuralC))

    expect((structuralA.products['101'] as { familyId?: number | null }).familyId).toBe(7)
    expect((structuralB.products['101'] as { familyId?: number | null }).familyId).toBe(8)
    expect((structuralC.products['101'] as { familyId?: number | null }).familyId).toBeNull()
  })
})
