import assert from 'node:assert/strict'
import test from 'node:test'
import { acquireExportSlot, parseExportBody, parseGenerateBody, zipEntryName } from './_label.endpoints'

test('parseGenerateBody validates count and store', () => {
  for (const bad of [{ count: 0 }, { count: 501 }, { count: 1.5 }, { count: '3' }, {}, null, 'x'])
    assert.equal(parseGenerateBody(bad), null, JSON.stringify(bad))
  assert.deepEqual(parseGenerateBody({ count: 100, store: ' فروشگاه ۱ ' }), { count: 100, store: 'فروشگاه ۱' })
  assert.deepEqual(parseGenerateBody({ count: 2 }), { count: 2, store: null })
  assert.equal(parseGenerateBody({ count: 2, store: 'x'.repeat(121) }), null)
})

test('parseExportBody validates, de-duplicates and caps ids', () => {
  assert.equal(parseExportBody({ ids: [] }), null)
  assert.equal(parseExportBody({ ids: Array.from({ length: 501 }, (_, i) => i + 1) }), null)
  assert.equal(parseExportBody({ ids: ['a'] }), null)
  assert.equal(parseExportBody({ ids: [0] }), null)
  assert.equal(parseExportBody({ ids: [2_147_483_648] }), null)
  assert.equal(parseExportBody({ ids: [Number.MAX_SAFE_INTEGER + 1] }), null)
  assert.deepEqual(parseExportBody({ ids: [2_147_483_647] }), [2_147_483_647])
  assert.deepEqual(parseExportBody({ ids: [3, 3, 4] }), [3, 4])
})

test('zipEntryName is safe', () => {
  assert.equal(zipEntryName(null, 'ABCD2345'), 'qr-ABCD2345.png')
  assert.equal(zipEntryName('../etc/x', 'ABCD2345'), 'etc-x-ABCD2345.png')
  assert.ok(!/[\\/]|\.\./.test(zipEntryName('a/b\\c..d', 'ABCD2345')))
})

test('acquireExportSlot allows one export at a time', () => {
  const release = acquireExportSlot()
  assert.ok(release)
  assert.equal(acquireExportSlot(), null)
  release()
  release()
  const again = acquireExportSlot()
  assert.ok(again)
  again()
})
