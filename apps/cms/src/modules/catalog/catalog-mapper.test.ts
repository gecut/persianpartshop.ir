import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultCatalogSettings } from '@persianpart/contract/public-catalog'
import type { Product } from '../../payload-types'
import { mapPublicProduct, publicConfig, toFamilyOption } from './catalog-mapper'

const product: Product = {
  id: 1,
  name: 'کالا',
  sku: 'SKU-1',
  slug: 'private-slug',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  basePricePerSqm: 1234567,
  inventorySqm: 98765,
  stockCartons: 98765,
  productType: 'tile',
  sqmPerCarton: 1.44,
}
const row = {
  id: 1,
  price: 1481480,
  quantity: 870,
  status: 'available' as const,
}
test('whitelist DTO hides internal fields and quantities in every mode', () => {
  for (const mode of ['hidden', 'status', 'numeric'] as const)
    for (const showPrice of [false, true]) {
      const settings = defaultCatalogSettings()
      settings.stock.mode = mode
      settings.stock.displayCap = 100
      settings.pricing.showPrice = showPrice
      const result = mapPublicProduct(product, row, settings),
        serialized = JSON.stringify(result)
      for (const value of [
        'basePricePerSqm',
        'scanCode',
        'inventorySqm',
        'stockCartons',
        'percentage',
        'INTERNAL-SECRET',
        '1234567',
        '98765',
        '870',
      ])
        assert.equal(serialized.includes(value), false)
      assert.equal(result.width, null)
      assert.equal(result.weight, null)
      if (!showPrice) assert.deepEqual(result.price, { mode: 'hidden' })
      if (mode === 'hidden') assert.deepEqual(result.stock, { mode: 'hidden' })
      if (mode === 'status')
        assert.deepEqual(result.stock, { mode: 'status', status: 'available' })
      if (mode === 'numeric')
        assert.deepEqual(result.stock, {
          mode: 'numeric',
          status: 'available',
          quantity: 100,
          capped: true,
        })
    }
})
test('public settings omit publication rules and percentages', () => {
  const settings = defaultCatalogSettings()
  settings.additions = [12345]
  settings.pricing.percentage = 37.5
  const config = publicConfig(settings, null, null)
  assert.equal('pricing' in config, false)
  assert.equal(JSON.stringify(config).includes('12345'), false)
  assert.equal(JSON.stringify(config).includes('37.5'), false)
})

test('cover identity is separate from gallery; aliases and duplicate gallery URLs are excluded', () => {
  const media = (id: number, filename: string) => ({ id, alt: filename, filename, mimeType: 'image/webp', width: 800, height: 800, createdAt: '2026-01-01', updatedAt: '2026-01-01' })
  const cover=media(1,'cover.webp'), gallery=media(2,'gallery.webp')
  const result=mapPublicProduct({...product,cover,gallery:[{image:cover},{image:gallery},{image:gallery}]},row,defaultCatalogSettings())
  assert.equal(result.cover?.alt,'cover.webp')
  assert.deepEqual(result.photos.map(photo=>photo.alt),['gallery.webp'])
})

test('toFamilyOption keeps hidden modes and drops non-option fields', () => {
  const settings = defaultCatalogSettings()
  settings.stock.mode = 'hidden'
  settings.pricing.showPrice = false
  const mapped = mapPublicProduct(product, row, settings)
  assert.deepEqual(mapped.price, { mode: 'hidden' })
  assert.deepEqual(mapped.stock, { mode: 'hidden' })

  const option = toFamilyOption(mapped)
  assert.deepEqual(option.price, { mode: 'hidden' })
  assert.deepEqual(option.stock, { mode: 'hidden' })

  const optionRecord = option as unknown as Record<string, unknown>
  for (const field of [
    'category',
    'sqmPerCarton',
    'piecesPerCarton',
    'secondaryUnit',
    'approxCoverage',
    'description',
    'cover',
    'photos',
    'updatedAt',
    'familyId',
    'family',
  ]) {
    assert.equal(field in optionRecord, false, `option must not contain ${field}`)
  }

  for (const field of [
    'id',
    'name',
    'sku',
    'productType',
    'brand',
    'dimension',
    'color',
    'grade',
    'tags',
    'width',
    'height',
    'unit',
    'weight',
    'itemsPerPack',
    'price',
    'stock',
  ]) {
    assert.ok(field in optionRecord, `option must contain ${field}`)
  }
})

const blurCSS = {
  backgroundImage: 'linear-gradient(90deg, rgb(1, 2, 3) 0% 100%)',
  backgroundPosition: '0 0%',
  backgroundSize: '100% 100%',
  backgroundRepeat: 'no-repeat',
}
const media = (id: number, extra: object = {}) => ({
  id,
  alt: '',
  mimeType: 'image/webp',
  filename: `m${id}.webp`,
  width: 100,
  height: 100,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...extra,
})
test('blur placeholder: cover always, gallery only in detail, legacy records stay valid', () => {
  const withMedia: Product = {
    ...product,
    cover: media(1, { blurCSS }),
    gallery: [{ image: media(2, { blurCSS }) }, { image: media(3, { blurCSS: { backgroundImage: 'url(https://x)' } }) }, { image: media(4) }],
  }
  const settings = defaultCatalogSettings()
  const list = mapPublicProduct(withMedia, row, settings)
  assert.deepEqual(list.cover?.blurCSS, blurCSS)
  assert.equal(list.photos.some(photo => photo.blurCSS), false)
  const detail = mapPublicProduct(withMedia, row, settings, true)
  assert.deepEqual(detail.photos.map(photo => Boolean(photo.blurCSS)), [true, false, false])
})
