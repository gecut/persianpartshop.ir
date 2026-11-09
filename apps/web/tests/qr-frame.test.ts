import { describe, expect, test } from 'bun:test'
import { isQrInsideFrame } from '../src/features/products/qr-frame'

describe('QR scanner frame', () => {
  test('accepts fully visible QR and rejects codes outside or crossing frame', () => {
    expect(isQrInsideFrame({ x: 100, y: 100, width: 200, height: 200 }, 400, 400, 400, 400)).toBe(true)
    expect(isQrInsideFrame({ x: 0, y: 100, width: 40, height: 40 }, 400, 400, 400, 400)).toBe(false)
    expect(isQrInsideFrame({ x: 40, y: 100, width: 40, height: 40 }, 400, 400, 400, 400)).toBe(false)
  })
  test('accounts for the crop when wide camera video covers a square', () => {
    expect(isQrInsideFrame({ x: 300, y: 100, width: 100, height: 100 }, 800, 400, 400, 400)).toBe(true)
    expect(isQrInsideFrame({ x: 100, y: 100, width: 100, height: 100 }, 800, 400, 400, 400)).toBe(false)
    expect(isQrInsideFrame({ x: 0, y: 0, width: 10, height: 10 }, 0, 400, 400, 400)).toBe(false)
  })
})
