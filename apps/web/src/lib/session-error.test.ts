import { describe, expect, test } from 'bun:test'
import { isSessionError } from './session-error'

describe('isSessionError', () => {
  test('identifies UNAUTHORIZED and 401 variants', () => {
    expect(isSessionError({ code: 'UNAUTHORIZED' })).toBe(true)
    expect(isSessionError({ status: 401 })).toBe(true)
    expect(isSessionError({ status: '401' })).toBe(true)
    expect(isSessionError({ error: { code: 'UNAUTHORIZED' } })).toBe(true)
    expect(isSessionError({ error: { status: 401 } })).toBe(true)
    expect(isSessionError({ error: { status: '401' } })).toBe(true)
  })

  test('identifies USER_BANNED code in data payloads', () => {
    expect(isSessionError({ data: { code: 'USER_BANNED' } })).toBe(true)
    expect(isSessionError({ error: { data: { code: 'USER_BANNED' } } })).toBe(true)
  })

  test('rejects unrelated errors', () => {
    expect(isSessionError(new Error('NOT_FOUND'))).toBe(false)
    expect(isSessionError({ code: 'BAD_REQUEST' })).toBe(false)
    expect(isSessionError({ status: 500 })).toBe(false)
    expect(isSessionError(null)).toBe(false)
    expect(isSessionError(undefined)).toBe(false)
  })
})
