import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CatalogSettingsSchema,
  StoredCatalogSettingsSchema,
  PublicCatalogBrowseSchema,
  defaultCatalogSettings,
  normalizeCatalogSearch,
} from './public-catalog'

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
