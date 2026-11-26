import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CatalogSettingsSchema,
  StoredCatalogSettingsSchema,
  PublicCatalogBrowseSchema,
  PublicCatalogFamilyOptionSchema,
  catalogOperations,
  defaultCatalogSettings,
  normalizeCatalogSearch,
} from './public-catalog'
import { QrTokenSchema } from './catalog'

test('normalization and complete stored defaults are restrictive and stable', () => {
  assert.equal(normalizeCatalogSearch('  كاشي‌۱۲٣ SKU-Ab  '), 'کاشی 123 sku-ab')
  assert.equal(
    PublicCatalogBrowseSchema.parse({ search: `${' '.repeat(400)}SKU-Ab` })
      .search,
    'sku-ab',
  )
  const settings = defaultCatalogSettings()
  assert.deepEqual(
    CatalogSettingsSchema.parse({
      ...settings,
      sharing: { ...settings.sharing, allowIndexing: true },
    }),
    settings,
  )
  assert.deepEqual(
    StoredCatalogSettingsSchema.parse({
      ...settings,
      contact: { ...settings.contact, linkToStore: true },
    }),
    settings,
  )
  assert.equal(settings.paused, true)
  assert.equal(settings.base, 'none')
  assert.equal(settings.stock.mode, 'status')
  for (const percentage of [-100, Infinity, NaN])
    assert.equal(
      CatalogSettingsSchema.safeParse({ pricing: { percentage } }).success,
      false,
    )
  assert.equal(
    CatalogSettingsSchema.safeParse({ criteria: { minPrice: 5, maxPrice: 1 } })
      .success,
    false,
  )
  assert.equal(StoredCatalogSettingsSchema.safeParse(settings).success, true)
  assert.equal(StoredCatalogSettingsSchema.safeParse({}).success, false)
  assert.equal(
    StoredCatalogSettingsSchema.safeParse({ ...settings, pricing: {} }).success,
    false,
  )
})

test('public catalog product operation enforces strict familyOptions', () => {
  const config = {
    title: 'تست',
    introduction: '',
    pausedMessage: '',
    priceNote: '',
    showPrice: true,
    stockMode: 'status' as const,
    watermark: false,
    sort: 'default' as const,
    shareTitle: '',
    shareDescription: '',
    shareImage: null,
    fallbackImage: null,
    contact: [],
  }
  const product = {
    id: '1',
    name: 'محصول ۱',
    sku: 'SKU-1',
    productType: 'tile' as const,
    category: null,
    brand: null,
    dimension: null,
    color: 'سفید',
    grade: 'grade_1' as const,
    tags: [],
    width: 60,
    height: 120,
    unit: 'm2',
    sqmPerCarton: 1.44,
    piecesPerCarton: 2,
    weight: 25,
    secondaryUnit: null,
    itemsPerPack: null,
    approxCoverage: null,
    description: '',
    cover: null,
    photos: [],
    price: { mode: 'amount' as const, amount: 100000 },
    stock: { mode: 'status' as const, status: 'available' as const },
    updatedAt: '2026-01-01',
  }
  const option = {
    id: '2',
    name: 'محصول ۲',
    sku: 'SKU-2',
    productType: 'tile' as const,
    brand: null,
    dimension: null,
    color: 'طوسی',
    grade: 'grade_2' as const,
    tags: [],
    width: 60,
    height: 120,
    unit: 'm2',
    weight: 25,
    itemsPerPack: null,
    price: { mode: 'amount' as const, amount: 120000 },
    stock: { mode: 'status' as const, status: 'available' as const },
  }

  // 1. Valid with empty familyOptions succeeds
  assert.doesNotThrow(() => {
    catalogOperations.product.output.parse({ config, product, familyOptions: [] })
  })

  // 2. Valid with an option succeeds
  assert.doesNotThrow(() => {
    catalogOperations.product.output.parse({
      config,
      product,
      familyOptions: [option],
    })
  })

  // 3. Omitting familyOptions fails
  assert.throws(() => {
    catalogOperations.product.output.parse({ config, product })
  })

  // 4. An option with an extra key fails
  assert.throws(() => {
    catalogOperations.product.output.parse({
      config,
      product,
      familyOptions: [{ ...option, familyId: 10 }],
    })
  })

  // 5. PublicCatalogFamilyOptionSchema directly rejects extra key
  assert.equal(
    PublicCatalogFamilyOptionSchema.safeParse({ ...option, familyId: 10 }).success,
    false,
  )
})

test('qr operation accepts a token and returns a product id', () => {
  assert.equal(catalogOperations.qr.input.safeParse({ token: 'abcd2345' }).success, true)
  assert.equal(catalogOperations.qr.input.safeParse({ token: 'abc', extra: 1 }).success, false)
  assert.equal(catalogOperations.qr.output.safeParse({ productId: 7 }).success, true)
  assert.equal(catalogOperations.qr.output.safeParse({ productId: 0 }).success, false)
})

test('QrTokenSchema trims, uppercases and rejects ambiguous symbols', () => {
  assert.equal(QrTokenSchema.parse(' abcd2345 '), 'ABCD2345')
  assert.equal(QrTokenSchema.safeParse('ABCD2340').success, false) // contains 0
  assert.equal(QrTokenSchema.safeParse('ABCDEFGHI').success, false) // 9 chars
})
