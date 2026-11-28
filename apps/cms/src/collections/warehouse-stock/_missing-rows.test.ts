import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeMissingRows } from './_missing-rows'

const b = (productId: number, sku: string, inventorySqm: number) => ({ productId, sku, name: `n${productId}`, productUpdatedAt: '2026-11-01T00:00:00.000Z', inventorySqm, revision: 3 })

test('keeps only positive balances whose SKU is absent from the file, sorted by product id', () => {
  const result = computeMissingRows({ fileSkus: new Set(['A']), balances: [b(9, 'C', 5), b(2, 'A', 7), b(4, 'B', 0), b(3, 'D', 0.01)] })
  assert.deepEqual(result.map(r => r.productId), [3, 9])
})

test('a SKU present only in an invalid or duplicate file row still counts as present', () => {
  // caller passes every SKU seen in the file, valid or not
  assert.deepEqual(computeMissingRows({ fileSkus: new Set(['A', 'BAD']), balances: [b(1, 'BAD', 10)] }), [])
})
