import { expect, test } from 'bun:test'
import { PRODUCT_GRADE_OPTIONS, type CatalogRecord } from '@persianpart/contract'
import { browseOffline } from '../src/modules/products/_browse-offline'
import { defaultBrowseFilters } from '../src/modules/products/_catalog-browse'

const product = (id: number, values: Partial<CatalogRecord> = {}): CatalogRecord => ({
  id, name: 'کاشی', sku: `PP-${id}`, slug: `p-${id}`, createdAt: '2026-01-01T00:00:00.000Z',
  hasScanCode: false, inventorySqm: 0, stockCartons: 0, availability: 'out_of_stock', finalCustomerPricePerSqm: 100,
  ...values,
})

test('offline search applies the online dimension, grade, tag and warehouse rules before sorting', () => {
  const grade = PRODUCT_GRADE_OPTIONS[0]!
  const products = [
    product(1, { width: 60, height: 120, grade: grade.value, tags: [{ id: 1, name: 'مات' }], matchesInStockFilter: true }),
    product(2, { width: 60, height: 120, grade: grade.value, tags: [{ id: 1, name: 'مات' }], matchesInStockFilter: false, hasSupplySource: true }),
    product(3, { width: 30, height: 60, grade: grade.value, tags: [{ id: 1, name: 'مات' }], matchesInStockFilter: true }),
  ]
  const filters = { ...defaultBrowseFilters, search: 'PP-', dimension: '60x120', grades: [grade.label], tags: ['مات'], inStock: true }
  expect(browseOffline(products, filters).map(record => record.id)).toEqual([1])
  expect(browseOffline(products, { ...filters, supplyMode: true }).map(record => record.id)).toEqual([2])
  expect(browseOffline(products, { ...defaultBrowseFilters, sort: 'cheapest' }).map(record => record.id)).toEqual([3, 2, 1])
  expect(browseOffline(products, { ...defaultBrowseFilters, sort: 'default' }).map(record => record.id)).toEqual([1, 2, 3])
})
