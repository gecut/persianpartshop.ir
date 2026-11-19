import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCatalogSearch, isDefaultCatalogSearch } from './catalog-search'

test('shared URLs preserve filters and reject invalid identifiers, ranges and oversized queries', () => {
  assert.equal(isDefaultCatalogSearch(parseCatalogSearch('')), true)
  const input = parseCatalogSearch(
    '?q=كاشي۱۲&category=1&brands=2,3&sort=newest&inStock=1',
  )
  assert.equal(input.search, 'کاشی12')
  assert.deepEqual(input.brandIds, [2, 3])
  assert.equal(input.inStock, true)
  assert.throws(() => parseCatalogSearch('?brands=NaN'))
  assert.throws(() => parseCatalogSearch('?minPrice=20&maxPrice=1'))
  assert.throws(() => parseCatalogSearch(`?q=${'a'.repeat(101)}`))
})
