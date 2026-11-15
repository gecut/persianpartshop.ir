import { expect, test } from 'bun:test'
import type { CatalogRecord } from '@persianpart/contract'
import { mapCatalogProduct } from '../src/modules/products/catalog-mapper'

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

test('keeps the cover on the card and preserves the remaining gallery order', () => {
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
  expect(mapped.gallery).toEqual(['/first.jpg', '/second.jpg'])
  expect(mapped.galleryMediaIds).toEqual({ '/first.jpg': '13' })
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
  expect(mapped.gallery).toEqual(['/first.jpg'])
})

test('excludes a cover alias when the gallery supplies the media ID', () => {
  const mapped = product({
    cover: '/cover.jpg',
    gallery: [{ image: { id: 12, url: '/alias.jpg' } }, { image: { id: 12, url: '/cover.jpg' } }],
  })
  expect(mapped.gallery).toEqual([])
})

test('does not synthesize gallery slides for the cover or placeholder', () => {
  expect(product({ cover: '/cover.jpg' }).gallery).toEqual([])
  expect(product({ gallery: [{ image: '/assets/images/placeholder.svg' }] }).gallery).toEqual([])
  expect(product({}).images[0]).toBe('/assets/images/placeholder.svg')
})
