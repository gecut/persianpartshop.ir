import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consolidateRequirements } from './_stock-operations'

test('consolidation uses hundredths and a stable product lock order', () => {
  assert.deepEqual(consolidateRequirements([
    { productId: 9, deliverableArea: 0.1 },
    { productId: 2, deliverableArea: 100.8 },
    { productId: 9, deliverableArea: 0.2 },
  ]), [{ productId: 2, deliverableArea: 100.8 }, { productId: 9, deliverableArea: 0.3 }])
})

test('invalid inventory input cannot reach a database write', () => {
  assert.throws(() => consolidateRequirements([]))
  for (const amount of [0, -1, NaN, Infinity, 1.001, Number.MAX_VALUE]) {
    assert.throws(() => consolidateRequirements([{ productId: 1, deliverableArea: amount }]))
  }
  for (const productId of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => consolidateRequirements([{ productId, deliverableArea: 1 }]))
  }
})
