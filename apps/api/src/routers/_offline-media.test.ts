import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OfflineSnapshotSchema } from '@persianpart/contract'
import { mediaEntries, projectMedia } from './_offline-media'

const savedMediaDir = process.env.MEDIA_DIR
let directory: string | undefined
afterEach(async () => {
  if (savedMediaDir === undefined) delete process.env.MEDIA_DIR
  else process.env.MEDIA_DIR = savedMediaDir
  if (directory) await rm(directory, { recursive: true, force: true })
})

test('downloads compact cover and history images once while keeping gallery originals', async () => {
  directory = await mkdtemp(join(tmpdir(), 'offline-media-'))
  process.env.MEDIA_DIR = directory
  const url = (file: string) => '/api/media/file/' + file + '.webp'
  const image = (id: number, original: string, thumb: string) => ({
    id, url: url(original), sizes: { galleryThumb: { url: url(thumb) } },
  })
  const product = { name: 'Tile', slug: 'tile', sku: 'tile', createdAt: '2026-01-01',
    inventorySqm: 1, stockCartons: 1, finalCustomerPricePerSqm: 100, hasScanCode: false, availability: 'available' }
  const cover = image(11, 'cover', 'cover-256')
  const gallery = image(12, 'gallery', 'gallery-256')
  const missing = image(13, 'other', 'missing-256')
  const data = OfflineSnapshotSchema.parse({
    products: {
      1: { ...product, id: 1, cover, gallery: [{ image: { ...cover, url: url('cover-alias') } }, { image: gallery }] },
      2: { ...product, id: 2, cover: gallery },
      3: { ...product, id: 3, cover: missing },
      4: { ...product, id: 4, gallery: [{ image: gallery }] },
    },
    activity: [{ kind: 'order', id: 1, orderNumber: '1', status: 'pending', statusLabel: 'pending',
      createdAt: '2026-01-01', totalAmount: 1, itemCount: 1, quantitySummary: '', canReorder: true,
      productImages: [cover.url, gallery.url, url('history')],
      productImageThumbnails: { [cover.url]: url('cover-256'), [gallery.url]: url('gallery-256'), [url('history')]: url('history-256') },
    }],
    dimensions: [], qr: {}, orders: {}, supplies: {}, plans: [],
    profile: { name: '', storeName: '', phone: '', documents: [] },
  })
  await Promise.all(['cover-256', 'gallery', 'other', 'history-256'].map(name =>
    writeFile(join(directory!, name + '.webp'), name)
  ))

  const projected = await projectMedia(data)
  expect(projected.products['1'].cover).toBe(url('cover-256'))
  expect(projected.products['1'].gallery?.map(item => item.image)).toEqual([gallery])
  expect(projected.products['2'].cover).toBe(gallery.url)
  expect(projected.products['3'].cover).toBe(missing.url)
  expect(projected.products['4'].cover).toBeUndefined()
  expect(projected.activity[0]).toMatchObject({ productImages: [url('cover-256'), gallery.url, url('history-256')] })
  expect((await mediaEntries(projected)).map(item => item.path)).toEqual(['cover-256', 'gallery', 'history-256', 'other'].map(url))
})
