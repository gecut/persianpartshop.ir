import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeLike, parseBoardQuery, parseInquiryBody } from './_board-query'

test('parseBoardQuery defaults and validation', () => {
  assert.deepEqual(parseBoardQuery(new URLSearchParams('')), { q: '', category: null, brand: null, filter: 'all', page: 1, limit: 50 })
  assert.deepEqual(parseBoardQuery(new URLSearchParams('q=%20abc%20&category=3&brand=4&filter=inquiry&page=2&limit=100')), { q: 'abc', category: 3, brand: 4, filter: 'inquiry', page: 2, limit: 100 })
  for (const bad of ['filter=x', 'page=0', 'page=1.5', 'limit=30', 'category=-1', 'brand=abc', `q=${'a'.repeat(101)}`]) assert.equal(parseBoardQuery(new URLSearchParams(bad)), null, bad)
})

test('escapeLike makes wildcards literal', () => {
  assert.equal(escapeLike('50%_a\\'), '50\\%\\_a\\\\')
})

test('parseInquiryBody rejects duplicates, oversize and bad shapes; sorts by product', () => {
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: [] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: [{ productId: 2, enabled: true }, { productId: 2, enabled: false }] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: Array.from({ length: 501 }, (_, i) => ({ productId: i + 1, enabled: true })) }), null)
  assert.equal(parseInquiryBody({ warehouseId: 0, changes: [{ productId: 1, enabled: true }] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, changes: [{ productId: 1, enabled: 'yes' }] }), null)
  assert.equal(parseInquiryBody({ warehouseId: 1, extra: 1, changes: [{ productId: 1, enabled: true }] }), null)
  assert.deepEqual(parseInquiryBody({ warehouseId: 1, changes: [{ productId: 9, enabled: false }, { productId: 3, enabled: true }] }), { warehouseId: 1, changes: [{ productId: 3, enabled: true }, { productId: 9, enabled: false }] })
})
