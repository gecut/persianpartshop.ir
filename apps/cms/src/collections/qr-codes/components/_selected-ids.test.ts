import assert from 'node:assert/strict'
import test from 'node:test'
import { selectedIds } from './_selected-ids'

test('keeps only selected numeric ids, de-duplicated', () => {
  const selected = new Map<string | number, boolean>([[1, true], ['2', true], [3, false], ['x', true], [1, true]])
  assert.deepEqual(selectedIds(selected), [1, 2])
})
test('empty selection gives an empty list', () => assert.deepEqual(selectedIds(new Map()), []))
