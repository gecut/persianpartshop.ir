import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirtyKey, emptyDirty, hasDirty, inquiryBatches, parseAmount, setAmount, setInquiry } from './_dirty'

test('amount edits that return to the original are dropped', () => {
  const k = dirtyKey(5, 2)
  let s = setAmount(emptyDirty, k, '12.5', 10)
  assert.equal(s.amounts[k], '12.5'); assert.ok(hasDirty(s))
  s = setAmount(s, k, '10', 10)
  assert.equal(hasDirty(s), false)
})

test('inquiry toggles back to original are dropped; batches group, sort and chunk', () => {
  let s = setInquiry(emptyDirty, dirtyKey(9, 1), true, false)
  s = setInquiry(s, dirtyKey(3, 1), false, true)
  s = setInquiry(s, dirtyKey(4, 7), true, false)
  assert.deepEqual(inquiryBatches(s), [
    { warehouseId: 1, changes: [{ productId: 3, enabled: false }, { productId: 9, enabled: true }] },
    { warehouseId: 7, changes: [{ productId: 4, enabled: true }] },
  ])
  assert.equal(hasDirty(setInquiry(s, dirtyKey(9, 1), false, false)), true)
  let big = emptyDirty
  for (let i = 1; i <= 501; i++) big = setInquiry(big, dirtyKey(i, 1), true, false)
  assert.deepEqual(inquiryBatches(big).map(b => b.changes.length), [500, 1])
})

test('parseAmount accepts two decimals only', () => {
  assert.equal(parseAmount('0'), 0); assert.equal(parseAmount('.5'), 0.5); assert.equal(parseAmount('12.34'), 12.34)
  for (const bad of ['', '-1', '1.234', 'abc', '1e3', '1000000001']) assert.equal(parseAmount(bad), null, bad)
})
