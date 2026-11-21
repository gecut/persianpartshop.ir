import { describe, expect, test } from 'bun:test'
import { CatalogRecordSchema } from '@persianpart/contract'
import type { Product } from '@persianpart/cms/types'
import type { Context } from '../rpc/context'
import { catalogRecord } from './catalog-sync'
import { familyIdOf } from './catalog.helpers'

function createProductFixture(family: Product['family'] = null): Product {
  return {
    id: 101,
    sku: 'IR-TEST-001',
    name: 'آلاوس طوسی مات',
    slug: 'alaves-grey-matte',
    createdAt: '2026-11-21T00:00:00.000Z',
    updatedAt: '2026-11-21T00:00:00.000Z',
    inventorySqm: 120,
    stockCartons: 40,
    availability: 'available',
    basePricePerSqm: 500000,
    family,
  } as unknown as Product
}

const mockContext = {
  user: { id: 1, role: 'customer' },
} as unknown as Context

const mockScope = {
  permissions: {
    markupPercent: 0,
    hideExactStock: false,
    canUseProductQr: false,
    allowedCategoryIds: [],
    disableOrdering: false,
  },
  scopeKey: 'test-scope-key',
}

describe('familyIdOf helper', () => {
  test('returns positive integer when input is a positive number', () => {
    expect(familyIdOf(7)).toBe(7)
    expect(familyIdOf(1)).toBe(1)
  })

  test('returns id when input is a populated object', () => {
    expect(familyIdOf({ id: 7, name: 'آلاوس' } as unknown as Product['family'])).toBe(7)
    expect(familyIdOf({ id: '7' } as unknown as Product['family'])).toBe(7)
  })

  test('returns null for null or undefined', () => {
    expect(familyIdOf(null)).toBeNull()
    expect(familyIdOf(undefined)).toBeNull()
  })

  test('returns null for non-positive or invalid values', () => {
    expect(familyIdOf(0 as unknown as Product['family'])).toBeNull()
    expect(familyIdOf(-1 as unknown as Product['family'])).toBeNull()
    expect(familyIdOf(3.14 as unknown as Product['family'])).toBeNull()
    expect(familyIdOf({ id: 0 } as unknown as Product['family'])).toBeNull()
    expect(familyIdOf({ id: -5 } as unknown as Product['family'])).toBeNull()
    expect(familyIdOf({ id: null } as unknown as Product['family'])).toBeNull()
    expect(familyIdOf({} as unknown as Product['family'])).toBeNull()
  })
})

describe('catalogRecord familyId derivation and isolation', () => {
  test('derives familyId when family is a numeric ID', () => {
    const product = createProductFixture(7)
    const record = catalogRecord(product, mockContext, mockScope)
    expect(record.familyId).toBe(7)
  })

  test('derives familyId from populated family object and strips raw family key', () => {
    const populatedFamily = { id: 7, name: 'آلاوس' } as unknown as Product['family']
    const product = createProductFixture(populatedFamily)
    const record = catalogRecord(product, mockContext, mockScope)
    expect(record.familyId).toBe(7)
    expect('family' in record).toBe(false)
    expect((record as Record<string, unknown>).family).toBeUndefined()
  })

  test('sets familyId to null when family is null', () => {
    const product = createProductFixture(null)
    const record = catalogRecord(product, mockContext, mockScope)
    expect(record.familyId).toBeNull()
    expect('family' in record).toBe(false)
  })

  test('sets familyId to null when family is undefined', () => {
    const product = createProductFixture(undefined)
    const record = catalogRecord(product, mockContext, mockScope)
    expect(record.familyId).toBeNull()
    expect('family' in record).toBe(false)
  })

  test('CatalogRecordSchema parses legacy records without familyId and rejects invalid familyId', () => {
    const baseRecord = {
      id: 1,
      sku: 'SKU-LEGACY',
      name: 'Legacy Product',
      slug: 'legacy-product',
      createdAt: '2026-01-01T00:00:00.000Z',
      inventorySqm: 0,
      stockCartons: 0,
      availability: 'out_of_stock',
      finalCustomerPricePerSqm: 0,
      hasScanCode: false,
    }

    const parsedLegacy = CatalogRecordSchema.parse(baseRecord)
    expect(parsedLegacy.familyId).toBeUndefined()

    const parsedNull = CatalogRecordSchema.parse({ ...baseRecord, familyId: null })
    expect(parsedNull.familyId).toBeNull()

    const parsedPositive = CatalogRecordSchema.parse({ ...baseRecord, familyId: 7 })
    expect(parsedPositive.familyId).toBe(7)

    expect(() => CatalogRecordSchema.parse({ ...baseRecord, familyId: 0 })).toThrow()
    expect(() => CatalogRecordSchema.parse({ ...baseRecord, familyId: -1 })).toThrow()
    expect(() => CatalogRecordSchema.parse({ ...baseRecord, familyId: 1.5 })).toThrow()
  })
})
