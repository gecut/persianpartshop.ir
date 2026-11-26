import { describe, expect, test } from 'bun:test'
import { buildQrTokenMap, qrProductId } from './qr-token.helpers'

describe('qrProductId', () => {
  test('reads ids from numbers and populated objects', () => {
    expect(qrProductId(7)).toBe(7)
    expect(qrProductId({ id: 9 })).toBe(9)
    expect(qrProductId(null)).toBeNull()
    expect(qrProductId(undefined)).toBeNull()
  })
})
describe('buildQrTokenMap', () => {
  test('keeps only active, bound, visible rows and uppercases tokens', () => {
    const rows = [
      { token: 'abcd2345', product: 1, isActive: true },
      { token: 'EFGH2345', product: { id: 2 }, isActive: true },
      { token: 'JKMN2345', product: 3, isActive: false },
      { token: 'PQRS2345', product: null, isActive: true },
      { token: 'TUVW2345', product: 99, isActive: true },
    ]
    expect(buildQrTokenMap(rows, new Set([1, 2, 3]))).toEqual({ ABCD2345: 1, EFGH2345: 2 })
  })
  test('two tokens may point to the same product', () => {
    const rows = [{ token: 'ABCD2345', product: 1, isActive: true }, { token: 'EFGH2345', product: 1, isActive: true }]
    expect(buildQrTokenMap(rows, new Set([1]))).toEqual({ ABCD2345: 1, EFGH2345: 1 })
  })
})
