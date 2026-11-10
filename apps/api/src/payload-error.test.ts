import { describe, expect, test } from 'bun:test'
import { handlePayloadError } from './payload-error'
import { ORPCError } from '@orpc/server'

describe('Payload error boundary', () => {
  test('uses structured codes independently of Persian wording', () => {
    for (const [status, sourceCode, expected] of [[409, 'INSUFFICIENT_STOCK', 'INSUFFICIENT_STOCK'], [409, 'STALE_ORDER', 'CONFLICT'], [403, 'ORDERING_DISABLED', 'FORBIDDEN'], [409, 'CANNOT_CANCEL', 'CANNOT_CANCEL']] as const) {
      try {
        handlePayloadError({ status, errors: [{ data: { code: sourceCode }, message: 'پیام قابل تغییر' }] })
      } catch (error) {
        expect(error).toBeInstanceOf(ORPCError)
        expect((error as ORPCError<string, unknown>).code).toBe(expected)
        expect((error as Error).message).toBe('پیام قابل تغییر')
      }
    }
  })
  test('field validation is specific and internal details are private', () => {
    expect(() => handlePayloadError({ status: 400, errors: [{ message: 'Fields invalid', data: { errors: [{ path: 'items', message: 'اقلام قابل ویرایش نیستند.' }] } }] })).toThrow('اقلام قابل ویرایش نیستند.')
    try { handlePayloadError({ status: 500, message: 'SQL password secret' }) }
    catch (error) {
      expect((error as Error).message).not.toContain('secret')
      expect((error as ORPCError<string, unknown>).code).toBe('INTERNAL_SERVER_ERROR')
    }
  })
})
