import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PublicCatalogConfigSchema,
  PublicCatalogProductSchema,
} from '@persianpart/contract/public-catalog'
import { buildProductShareMetadata } from './_product-share-metadata'

const product = PublicCatalogProductSchema.parse({
  id: '1',
  name: 'کاشی',
  sku: 'SKU-1',
  productType: 'tile',
  category: null,
  brand: null,
  dimension: null,
  color: null,
  grade: null,
  tags: [],
  width: null,
  height: null,
  unit: 'm2',
  sqmPerCarton: null,
  piecesPerCarton: null,
  weight: null,
  secondaryUnit: null,
  itemsPerPack: null,
  approxCoverage: null,
  description: 'Private commercial notes',
  photos: [],
  price: { mode: 'amount', amount: 1234567 },
  stock: {
    mode: 'numeric',
    quantity: 98765,
    capped: false,
    status: 'available',
  },
  updatedAt: '2026-11-18T00:00:00Z',
})
const config = PublicCatalogConfigSchema.parse({
  title: 'Catalog',
  introduction: '',
  pausedMessage: '',
  priceNote: '',
  showPrice: true,
  stockMode: 'numeric',
  watermark: false,
  sort: 'default',
  shareTitle: 'Catalog',
  shareDescription: 'Catalog description',
  shareImage: null,
  fallbackImage: null,
  contact: [],
})

test('sharing exposes technical identity, never commercial data or SEO markup', () => {
  const metadata = buildProductShareMetadata(
    { product, config },
    'https://catalog.example.com',
  )
  assert.equal(metadata.title, product.name)
  assert.equal(metadata.description, product.name)
  assert.equal(metadata.openGraph?.url, 'https://catalog.example.com/p/1')
  assert.equal(metadata.alternates, undefined)
  for (const privateValue of ['1234567', '98765', 'Private commercial notes'])
    assert.equal(JSON.stringify(metadata).includes(privateValue), false)
})
test('sharing images prefer product, then configured sharing image, then fallback', () => {
  const image = (name: string) => ({
    url: `https://cdn.example.com/${name}.jpg`,
    width: 800,
    height: 800,
    alt: name,
  })
  for (const [cover, photos, shareImage, fallbackImage, expected] of [
    [
      image('cover'),
      [image('product')],
      image('share'),
      image('fallback'),
      'cover',
    ],
    [null, [image('product')], image('share'), image('fallback'), 'product'],
    [null, [], image('share'), image('fallback'), 'share'],
    [null, [], null, image('fallback'), 'fallback'],
  ] as const) {
    const metadata = buildProductShareMetadata(
      {
        product: { ...product, cover, photos: [...photos] },
        config: { ...config, shareImage, fallbackImage },
      },
      'https://catalog.example.com',
    )
    assert.equal(
      JSON.stringify(metadata.openGraph?.images).includes(`/${expected}.jpg`),
      true,
    )
  }
})
