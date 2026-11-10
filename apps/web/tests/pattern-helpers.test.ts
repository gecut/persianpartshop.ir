import { describe, expect, test } from 'bun:test'
import { resolveMediaUrl } from '../src/modules/products/catalog-mapper'
import { isSessionError } from '../src/lib/session-error'

describe('resolveMediaUrl', () => {
  test('resolves absolute and root-relative URLs directly', () => {
    expect(resolveMediaUrl('https://example.com/tile.jpg')).toBe('https://example.com/tile.jpg')
    expect(resolveMediaUrl('http://example.com/tile.jpg')).toBe('http://example.com/tile.jpg')
    expect(resolveMediaUrl('/assets/images/tile.jpg')).toBe('/assets/images/tile.jpg')
  })

  test('resolves standalone filenames to media API path', () => {
    expect(resolveMediaUrl('sample-tile.png')).toBe('/api/media/file/sample-tile.png')
  })

  test('resolves object with url', () => {
    expect(resolveMediaUrl({ url: 'https://cdn.example.com/tile.png' })).toBe('https://cdn.example.com/tile.png')
  })

  test('falls back to filename when url is empty string', () => {
    expect(resolveMediaUrl({ url: '', filename: 'tile-fallback.jpg' })).toBe('/api/media/file/tile-fallback.jpg')
  })

  test('resolves thumbnailURL when url is absent', () => {
    expect(resolveMediaUrl({ thumbnailURL: 'https://thumb.example.com/tile.jpg' })).toBe('https://thumb.example.com/tile.jpg')
  })

  test('resolves nested image object recursively', () => {
    expect(resolveMediaUrl({ image: { url: '/nested-image.jpg' } })).toBe('/nested-image.jpg')
  })

  test('returns empty string for nullish or invalid values', () => {
    expect(resolveMediaUrl(null)).toBe('')
    expect(resolveMediaUrl(undefined)).toBe('')
    expect(resolveMediaUrl('')).toBe('')
    expect(resolveMediaUrl(12345)).toBe('')
  })
})

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
