import { RPCHandler } from '@orpc/server/fetch'
import { describe, expect, mock, test } from 'bun:test'
let lookup: 'ok' | 'missing' | 'offline' | 'banned' = 'ok'
let showWatermark: boolean | undefined
let profileWrite: Record<string, unknown> | undefined
const account = () => ({
  id: 1, status: 'active', isActive: true, isBanned: lookup === 'banned', phone: '09120000001',
  fullName: 'مشتری آزمایشی', companyName: 'فروشگاه آزمایشی', province: 'تهران', city: 'تهران', address: 'نشانی آزمایشی',
  ...(showWatermark === undefined ? {} : { showProductImageWatermark: showWatermark }),
})
mock.module('../payload', () => ({ sdk: {
  findByID: async () => {
    if (lookup === 'offline') throw new Error('CMS is unavailable')
    if (lookup === 'missing') throw Object.assign(new Error('Not found'), { status: 404 })
    return account()
  },
  find: async ({ collection }: { collection: string }) => ({
    docs: collection === 'otps'
      ? [{ id: 1, code: '1234', attempts: 0, expiresAt: new Date(Date.now() + 60_000).toISOString() }]
      : [account()],
  }),
  update: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    if (collection === 'users') profileWrite = data
    return { ...account(), ...data }
  },
} }))
const { createContext } = await import('./context')
const { base } = await import('./base')
const { generateToken } = await import('../lib/jwt')
const { offlineAccessUntil } = await import('../lib/offline-access')
const { auth } = await import('../routers/auth')
const { user } = await import('../routers/user')
const request = async () => new Request('http://fixture.test/api/rpc/auth/session', { headers: { Authorization: `Bearer ${await generateToken({ id: 1 })}` } })
describe('session lookup failure semantics', () => {
  test('offline access stops at the earlier of token expiration or seven days', () => {
    const now = 1_800_000_000_000
    expect(offlineAccessUntil(now / 1000 + 60, now)).toBe(now + 60_000)
    expect(offlineAccessUntil(now / 1000 + 30 * 86400, now)).toBe(now + 7 * 86400_000)
    expect(offlineAccessUntil(undefined, now)).toBeUndefined()
  })
  test('valid session is authenticated', async () => { lookup = 'ok'; expect((await createContext(await request())).user?.id).toBe(1) })
  test('service failure is not converted to an anonymous session', async () => {
    lookup = 'offline'
    expect((await createContext(await request())).authUnavailable).toBe(true)
  })
  test('removed account is unauthenticated', async () => { lookup = 'missing'; expect((await createContext(await request())).user).toBeNull() })
  test('ban remains an explicit account state', async () => { lookup = 'banned'; expect((await createContext(await request())).isBanned).toBe(true) })
  test('context outage is serialized as service unavailable over RPC', async () => {
    lookup = 'offline'
    const handler = new RPCHandler({ session: base.auth.session.handler(({ context }) => ({ user: context.user && { ...context.user } })) })
    const req = new Request('http://fixture.test/rpc/session', { method: 'POST', headers: { Authorization: `Bearer ${await generateToken({ id: 1 })}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ json: null }) })
    const result = await handler.handle(req, { prefix: '/rpc', context: () => createContext(req) })
    expect(result.response?.status).toBe(503)
  })
  test('missing credentials are a guest', async () => { expect((await createContext(new Request('http://fixture.test'))).user).toBeNull() })
})

test('watermark is a read-only account flag returned by login and session', async () => {
  lookup = 'ok'
  const handler = new RPCHandler({ auth, user })
  type AccountFlag = { showProductImageWatermark: boolean }
  const rpc = async (path: string, input: unknown, token?: string) => {
    const req = new Request(`http://fixture.test/rpc/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ json: input }),
    })
    const result = await handler.handle(req, { prefix: '/rpc', context: () => createContext(req) })
    expect(result.response?.status).toBe(200)
    const body = await result.response!.json() as { json: { user: AccountFlag; customer: AccountFlag; token: string } }
    return body.json
  }

  for (const flag of [true, false, undefined]) {
    showWatermark = flag
    const login = await rpc('auth/verifyOtp', { phone: '09120000001', code: '1234' })
    expect(login.user.showProductImageWatermark).toBe(flag === true)
    expect(login.customer.showProductImageWatermark).toBe(flag === true)
    const session = await rpc('auth/session', null, login.token)
    expect(session.user.showProductImageWatermark).toBe(flag === true)
  }

  const token = await generateToken({ id: 1, role: 'customer' })
  showWatermark = true
  await rpc('user/update', { fullName: 'نام جدید', showProductImageWatermark: false }, token)
  expect(profileWrite).toEqual({ fullName: 'نام جدید' })
  expect((await rpc('auth/session', null, token)).user.showProductImageWatermark).toBe(true)
  showWatermark = false
  expect((await rpc('auth/session', null, token)).user.showProductImageWatermark).toBe(false)
})
