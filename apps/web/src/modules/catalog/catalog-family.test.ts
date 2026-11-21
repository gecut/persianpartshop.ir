import { describe, expect, test } from 'bun:test'
import type { CatalogRecord } from '@persianpart/contract'
import { familyMembers } from './catalog-family'

function createRecord(partial: Partial<CatalogRecord> & { id: number | string; name: string }): CatalogRecord {
  const { id, name, ...rest } = partial
  return {
    id,
    sku: `SKU-${id}`,
    name,
    slug: `product-${id}`,
    createdAt: '2026-11-21T00:00:00.000Z',
    inventorySqm: 100,
    stockCartons: 50,
    availability: 'available',
    finalCustomerPricePerSqm: 250000,
    hasScanCode: false,
    ...rest,
  } as CatalogRecord
}

describe('familyMembers pure function', () => {
  test('returns [] when familyId is null or undefined, even when records have null or undefined familyId', () => {
    const byId: Record<string, CatalogRecord> = {
      '1': createRecord({ id: 1, name: 'کالای ۱', familyId: null }),
      '2': createRecord({ id: 2, name: 'کالای ۲', familyId: undefined }),
      '3': createRecord({ id: 3, name: 'کالای ۳', familyId: 10 }),
    }

    expect(familyMembers(byId, null)).toEqual([])
    expect(familyMembers(byId, undefined)).toEqual([])
  })

  test('filters by matching non-null familyId and sorts by name (fa), width, height, grade, numeric id', () => {
    const byId: Record<string, CatalogRecord> = {
      '1': createRecord({ id: 1, name: 'ب', width: 120, height: 280, grade: 'grade_d', familyId: 1 }),
      '2': createRecord({ id: 2, name: 'ب', width: 120, height: 120, grade: 'grade_1', familyId: 1 }),
      '3': createRecord({ id: 3, name: 'الف', width: 120, height: 280, grade: 'grade_1', familyId: 1 }),
      '4': createRecord({ id: 4, name: 'الف', width: 60, height: 120, familyId: 2 }),
      '5': createRecord({ id: 5, name: 'بدون طرح' }),
    }

    const result = familyMembers(byId, 1)
    expect(result.map(r => r.id)).toEqual([3, 2, 1])
  })

  test('sorts same name and size: grade_1 before grade_d, unknown grade last', () => {
    const byId: Record<string, CatalogRecord> = {
      '1': createRecord({ id: 1, name: 'طرح تست', width: 60, height: 120, grade: 'grade_d', familyId: 5 }),
      '2': createRecord({ id: 2, name: 'طرح تست', width: 60, height: 120, grade: 'unknown_grade', familyId: 5 }),
      '3': createRecord({ id: 3, name: 'طرح تست', width: 60, height: 120, grade: 'grade_1', familyId: 5 }),
      '4': createRecord({ id: 4, name: 'طرح تست', width: 60, height: 120, grade: null, familyId: 5 }),
    }

    const result = familyMembers(byId, 5)
    expect(result.map(r => r.id)).toEqual([3, 1, 2, 4])
  })

  test('reads width from dimension.width when present, else record.width; null widths last', () => {
    const byId: Record<string, CatalogRecord> = {
      '1': createRecord({ id: 1, name: 'طرح یکسان', width: null, height: 100, familyId: 9 }),
      '2': createRecord({ id: 2, name: 'طرح یکسان', dimension: { id: 10, name: '۸۰×۱۰۰', width: 80, height: 100 }, width: 60, familyId: 9 }),
      '3': createRecord({ id: 3, name: 'طرح یکسان', width: 70, height: 100, familyId: 9 }),
    }

    const result = familyMembers(byId, 9)
    // record 2 dimension.width=80 overrides record.width=60; record 3 width=70; record 1 width=null (last)
    expect(result.map(r => r.id)).toEqual([3, 2, 1])
  })

  test('breaks total ties by numeric id', () => {
    const byId: Record<string, CatalogRecord> = {
      '20': createRecord({ id: 20, name: 'یکسان', width: 60, height: 60, grade: 'grade_1', familyId: 3 }),
      '5': createRecord({ id: 5, name: 'یکسان', width: 60, height: 60, grade: 'grade_1', familyId: 3 }),
      '100': createRecord({ id: 100, name: 'یکسان', width: 60, height: 60, grade: 'grade_1', familyId: 3 }),
    }

    const result = familyMembers(byId, 3)
    expect(result.map(r => Number(r.id))).toEqual([5, 20, 100])
  })

  test('does not mutate input byId record map', () => {
    const byId: Record<string, CatalogRecord> = {
      '2': createRecord({ id: 2, name: 'ب', familyId: 8 }),
      '1': createRecord({ id: 1, name: 'الف', familyId: 8 }),
    }
    const originalKeys = Object.keys(byId)
    familyMembers(byId, 8)
    expect(Object.keys(byId)).toEqual(originalKeys)
  })
})
