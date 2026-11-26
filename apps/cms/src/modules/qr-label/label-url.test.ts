import assert from 'node:assert/strict'
import test from 'node:test'
import { labelUrl } from './label-url'

test('labelUrl is uppercase and uses the catalog origin only', () => {
  assert.equal(labelUrl('https://catalog.persianpartshop.ir/some/path', 'abcd2345'), 'HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/ABCD2345')
})

test('labelUrl rejects invalid tokens', () => {
  assert.throws(() => labelUrl('https://catalog.persianpartshop.ir', 'bad'), RangeError)
})
