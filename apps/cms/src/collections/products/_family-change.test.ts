import assert from 'node:assert/strict'
import { test } from 'node:test'
import { familyChange } from './_family-change'

test('familyChange detects no change when values normalize to identical ids', () => {
  assert.equal(familyChange(3, { id: 3 }), null)
  assert.equal(familyChange(null, undefined), null)
})

test('familyChange formats addition and removal with fa-IR digits', () => {
  assert.equal(familyChange(null, 5), 'طرح: - -> ۵')
  assert.equal(familyChange({ id: 2 }, null), 'طرح: ۲ -> -')
})
