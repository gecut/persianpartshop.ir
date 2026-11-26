import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanToken, resolveQrTarget } from './qr-server'

test('cleanToken accepts only canonical tokens, any case, trimmed', () => {
  assert.equal(cleanToken(' abcd2345 '), 'ABCD2345')
  for (const bad of ['abcd234', 'ABCD2340', 'ABCD23456', '', 'abcd2345/x']) assert.equal(cleanToken(bad), null, bad)
})

test('resolveQrTarget maps outcomes', async () => {
  assert.deepEqual(await resolveQrTarget('abcd2345', async () => ({ productId: 7 })), { kind: 'product', id: 7 })
  assert.deepEqual(await resolveQrTarget('bad', async () => ({ productId: 7 })), { kind: 'inactive' })
  const inactive = Object.assign(new Error('x'), { qrInactive: true })
  assert.deepEqual(await resolveQrTarget('ABCD2345', async () => { throw inactive }, (e) => e === inactive), { kind: 'inactive' })
  await assert.rejects(() => resolveQrTarget('ABCD2345', async () => { throw new Error('boom') }, () => false), /boom/)
})
