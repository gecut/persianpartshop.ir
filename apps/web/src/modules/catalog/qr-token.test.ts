import { describe, expect, test } from 'bun:test'
import { parseQrToken } from './qr-token'

describe('parseQrToken', () => {
  test('reads the token from catalog urls in any case', () => {
    expect(parseQrToken('HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/ABCD2345')).toBe('ABCD2345')
    expect(parseQrToken('https://x.ir/q/abcd2345/?a=1#b')).toBe('ABCD2345')
    expect(parseQrToken(' /Q/abcd2345 ')).toBe('ABCD2345')
  })
  test('accepts a bare token for manual entry', () => {
    expect(parseQrToken('abcd2345')).toBe('ABCD2345')
  })
  test('rejects everything else', () => {
    for (const bad of ['https://x.ir/p/12', 'ABCD2340', 'ABCD23456', '', '   ', 'javascript:alert(1)'])
      expect(parseQrToken(bad)).toBeNull()
  })
})
