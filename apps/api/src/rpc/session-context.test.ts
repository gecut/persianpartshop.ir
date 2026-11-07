import { RPCHandler } from '@orpc/server/fetch'
import { describe, expect, mock, test } from 'bun:test'
let lookup: 'ok' | 'missing' | 'offline' | 'banned' = 'ok'
mock.module('../payload', () => ({ sdk: { findByID: async () => {
  if (lookup === 'offline') throw new Error('CMS is unavailable')
  if (lookup === 'missing') throw Object.assign(new Error('Not found'), { status: 404 })
  return { id: 1, isActive: true, isBanned: lookup === 'banned', phone: '09120000001' }
} } }))
const { createContext } = await import('./context')
const { base } = await import('./base')
const { generateToken } = await import('../lib/jwt')
const request = async () => new Request('http://fixture.test/api/rpc/auth/session', { headers: { Authorization: `Bearer ${await generateToken({ id: 1 })}` } })
describe('session lookup failure semantics', () => {
  test('valid session is authenticated', async () => { lookup = 'ok'; expect((await createContext(await request())).user?.id).toBe(1) })
  test('service failure is not converted to an anonymous session', async () => {
    lookup = 'offline'
    expect((await createContext(await request())).authUnavailable).toBe(true)
  })
  test('removed account is unauthenticated', async () => { lookup = 'missing'; expect((await createContext(await request())).user).toBeNull() })
  test('ban remains an explicit account state', async () => { lookup = 'banned'; expect((await createContext(await request())).isBanned).toBe(true) })
  test('context outage is serialized as service unavailable over RPC', async () => {
    lookup = 'offline'
    const handler = new RPCHandler({ session: base.auth.session.handler(({ context }) => ({ user: context.user })) })
    const req = new Request('http://fixture.test/rpc/session', { method: 'POST', headers: { Authorization: `Bearer ${await generateToken({ id: 1 })}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ json: null }) })
    const result = await handler.handle(req, { prefix: '/rpc', context: () => createContext(req) })
    expect(result.response?.status).toBe(503)
  })
  test('missing credentials are a guest', async () => { expect((await createContext(new Request('http://fixture.test'))).user).toBeNull() })
})
