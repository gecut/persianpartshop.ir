import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveQr, type QrDeps } from './catalog-qr'

const row = { product: 7, isActive: true as boolean | null | undefined }
const deps = (over: Partial<QrDeps> = {}): QrDeps => ({
  findByToken: async (token) => (token === 'ABCD2345' ? row : null),
  isPublished: async (id) => id === 7,
  ...over,
})
const inactive = (error: unknown) => (error as { status?: number; data?: { code?: string } }).status === 404 &&
  (error as { data?: { code?: string } }).data?.code === 'QR_INACTIVE'

test('active bound published token resolves, in any case and with spaces', async () => {
  assert.deepEqual(await resolveQr(deps(), 'abcd2345'), { productId: 7 })
  assert.deepEqual(await resolveQr(deps(), '  ABCD2345 '), { productId: 7 })
})

test('unknown, malformed, inactive, unbound and unpublished all fail the same way', async () => {
  for (const [d, token] of [
    [deps(), 'ZZZZ2222'],
    [deps(), 'bad'],
    [deps(), '../../etc'],
    [deps(), 'x'.repeat(5000)],
    [deps({ findByToken: async () => ({ product: 7, isActive: false }) }), 'ABCD2345'],
    [deps({ findByToken: async () => ({ product: null, isActive: true }) }), 'ABCD2345'],
    [deps({ isPublished: async () => false }), 'ABCD2345'],
  ] as const) {
    await assert.rejects(() => resolveQr(d, token), inactive)
  }
})

test('malformed tokens never reach the database', async () => {
  let calls = 0
  await assert.rejects(() => resolveQr(deps({ findByToken: async () => { calls++; return null } }), 'nope'), inactive)
  assert.equal(calls, 0)
})
