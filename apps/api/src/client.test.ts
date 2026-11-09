import { describe, expect, test } from 'bun:test'
import { createApiClient } from './client'
const mockedFetch = (fn: () => Promise<Response>): typeof fetch => Object.assign(fn, { preconnect() {} })

describe('RPC lifecycle and authentication boundary', () => {
  test('reports decoded authentication errors exactly once without rereading the body', async () => {
    const errors: unknown[] = []
    const response = Response.json({ json: { defined: false, code: 'UNAUTHORIZED', message: 'Expired' } }, { status: 401 })
    Object.defineProperty(response, 'clone', { value: () => { throw new Error('A second response buffer must not be needed') } })
    const client = createApiClient({ baseURL: 'http://fixture.test', fetch: mockedFetch(async () => response), onAuthError: error => errors.push(error) })
    await expect(client.auth.session()).rejects.toHaveProperty('code', 'UNAUTHORIZED')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toHaveProperty('code', 'UNAUTHORIZED')
  })
  test('business forbidden errors do not end a session', async () => {
    let errors = 0
    const client = createApiClient({ baseURL: 'http://fixture.test', fetch: mockedFetch(async () => Response.json({ json: { defined: false, code: 'FORBIDDEN', message: 'Cannot order' } }, { status: 403 })), onAuthError: () => errors++ })
    await expect(client.auth.session()).rejects.toHaveProperty('code', 'FORBIDDEN')
    expect(errors).toBe(0)
  })
  test('a decoded account ban ends the session', async () => {
    let errors = 0
    const client = createApiClient({ baseURL: 'http://fixture.test', fetch: mockedFetch(async () => Response.json({ json: { defined: false, code: 'FORBIDDEN', message: 'Banned', data: { code: 'USER_BANNED' } } }, { status: 403 })), onAuthError: () => errors++ })
    await expect(client.auth.session()).rejects.toHaveProperty('code', 'FORBIDDEN')
    expect(errors).toBe(1)
  })
  test('a stale account failure cannot log out the next account', async () => {
    let token = 'first', errors = 0
    const client = createApiClient({ baseURL: 'http://fixture.test', getToken: () => token, fetch: mockedFetch(async () => { token = 'second'; return Response.json({ json: { defined: false, code: 'UNAUTHORIZED', message: 'Expired' } }, { status: 401 }) }), onAuthError: () => errors++ })
    await expect(client.auth.session()).rejects.toHaveProperty('name', 'AbortError')
    expect(errors).toBe(0)
  })
})
