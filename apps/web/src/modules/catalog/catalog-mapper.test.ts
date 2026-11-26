import { describe, expect, test } from 'bun:test'
import { CatalogRecordSchema, type CatalogRecord } from '@persianpart/contract'
import { mapCatalogProduct } from '@/modules/catalog/catalog-mapper'
import { resolveMediaUrl } from '@/lib/media-url'

function product(media: Pick<CatalogRecord, 'cover' | 'gallery'>) {
  return mapCatalogProduct({
    id: 1,
    name: 'کاشی',
    slug: 'tile',
    sku: 'PP-1',
    inventorySqm: 1,
    stockCartons: 1,
    availability: 'available',
    finalCustomerPricePerSqm: 100,
    ...media,
  })
}

test('keeps the cover in both images and gallery without duplicating aliases or repeats', () => {
  const mapped = product({
    cover: { id: 12, url: '/cover.jpg' },
    gallery: [
      { image: { id: '12', url: '/cover-alias.jpg' } },
      { image: { id: 13, url: '/first.jpg' } },
      { image: '/cover.jpg' },
      { image: { id: '13', url: '/first-alias.jpg' } },
      { image: '/second.jpg' },
      { image: { id: 14, url: '/second.jpg' } },
      { image: 15 },
    ],
  })
  expect(mapped.images[0]).toBe('/cover.jpg')
  expect(mapped.gallery).toEqual(['/cover.jpg', '/first.jpg', '/second.jpg'])
  expect(mapped.galleryMediaIds).toEqual({ '/cover.jpg': '12', '/first.jpg': '13' })
})

test('prepends the cover to gallery when gallery omits it, including single-cover products', () => {
  const withScenesOnly = product({
    cover: { id: 141, url: '/face.webp' },
    gallery: [{ image: { id: 1490, url: '/scene.webp' } }],
  })
  expect(withScenesOnly.images).toEqual(['/face.webp', '/scene.webp'])
  expect(withScenesOnly.gallery).toEqual(['/face.webp', '/scene.webp'])

  const coverOnly = product({ cover: { id: 67, url: '/cover.jpg' }, gallery: [] })
  expect(coverOnly.images).toEqual(['/cover.jpg'])
  expect(coverOnly.gallery).toEqual(['/cover.jpg'])
})

test('keeps the first gallery photo when it also serves as the card fallback', () => {
  const mapped = product({ gallery: [{ image: '/first.jpg' }, { image: '/second.jpg' }] })
  expect(mapped.images[0]).toBe('/first.jpg')
  expect(mapped.gallery).toEqual(['/first.jpg', '/second.jpg'])
})

test('uses the matching gallery media URL to resolve an ID-only cover', () => {
  const mapped = product({
    cover: 'cover-id',
    gallery: [{ image: '/first.jpg' }, { image: '/cover.jpg' }, { image: { id: 'cover-id', url: '/cover.jpg' } }],
  })
  expect(mapped.images[0]).toBe('/cover.jpg')
  expect(mapped.gallery).toEqual(['/first.jpg', '/cover.jpg'])
})

test('excludes a duplicate cover alias when the gallery supplies the media ID', () => {
  const mapped = product({
    cover: '/cover.jpg',
    gallery: [{ image: { id: 12, url: '/alias.jpg' } }, { image: { id: 12, url: '/cover.jpg' } }],
  })
  expect(mapped.gallery).toEqual(['/cover.jpg'])
  expect(mapped.images).toEqual(['/cover.jpg'])
})

test('does not synthesize gallery slides for the placeholder', () => {
  expect(product({ cover: '/assets/images/placeholder.svg' }).gallery).toEqual([])
  expect(product({ gallery: [{ image: '/assets/images/placeholder.svg' }] }).gallery).toEqual([])
  expect(product({}).gallery).toEqual([])
  expect(product({}).images[0]).toBe('/assets/images/placeholder.svg')
})

test('preserves gallery variants through the catalog contract without replacing original URLs', () => {
  const mapped = mapCatalogProduct(CatalogRecordSchema.parse({
    id: 1,
    name: 'کاشی',
    slug: 'tile',
    sku: 'PP-1',
    availability: 'available',
    finalCustomerPricePerSqm: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    inventorySqm: 1,
    stockCartons: 1,
    cover: { id: 12, url: '/cover.webp' },
    gallery: [
      { image: { id: 12, url: '/cover.webp', sizes: { galleryThumb: { url: '/cover-small.webp' } } } },
      { image: { id: 13, url: '/first.webp', width: 1400, height: 700, sizes: {
        galleryThumb: { url: '/first-small.webp' },
        galleryPreview: { url: '/first-preview.webp' },
      } } },
      { image: '/legacy.webp' },
    ],
  }))
  expect(mapped.images).toEqual(['/cover.webp', '/first.webp', '/legacy.webp'])
  expect(mapped.gallery).toEqual(['/cover.webp', '/first.webp', '/legacy.webp'])
  expect(mapped.thumbnailUrl).toBe('/cover-small.webp')
  expect(mapped.galleryMediaDetails).toEqual({
    '/cover.webp': { thumbnailUrl: '/cover-small.webp' },
    '/first.webp': { thumbnailUrl: '/first-small.webp', previewUrl: '/first-preview.webp', ratio: 2 },
  })
})

describe('resolveMediaUrl', () => {
  test('resolves absolute and root-relative URLs directly', () => {
    expect(resolveMediaUrl('https://example.com/tile.jpg')).toBe('https://example.com/tile.jpg')
    expect(resolveMediaUrl('http://example.com/tile.jpg')).toBe('http://example.com/tile.jpg')
    expect(resolveMediaUrl('/assets/images/tile.jpg')).toBe('/assets/images/tile.jpg')
  })

  // VITE_CDN_URL comes from the environment; files resolve under the CDN when set, else the media API.
  const mediaBase = import.meta.env.VITE_CDN_URL?.replace(/\/+$/, '') || '/api/media/file'

  test('resolves standalone filenames to the CDN or media API path', () => {
    expect(resolveMediaUrl('sample-tile.png')).toBe(`${mediaBase}/sample-tile.png`)
  })

  test('resolves object with url', () => {
    expect(resolveMediaUrl({ url: 'https://cdn.example.com/tile.png' })).toBe('https://cdn.example.com/tile.png')
  })

  test('falls back to filename when url is empty string', () => {
    expect(resolveMediaUrl({ url: '', filename: 'tile-fallback.jpg' })).toBe(`${mediaBase}/tile-fallback.jpg`)
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
