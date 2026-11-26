import { oc } from '@orpc/contract'
import { z } from 'zod'
import { ActivityFeedItemSchema } from './activity-feed'
import { CatalogRecordSchema, DimensionSchema, QrTokenSchema } from './catalog'
import { CustomerOrderDocumentSchema } from './order'
import { PlanSchema } from './plan'
import { selectCatalogPhotos, type CatalogMedia } from './media'
import { SupplyRequestSchema } from './supply-request'

export const OfflineProfileSchema = z.object({
  name: z.string(),
  storeName: z.string(),
  phone: z.string(),
  documents: z.array(z.object({
    id: z.string().optional(),
    documentType: z.string().optional(),
    title: z.string().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    rejectionReason: z.string().nullable().optional(),
    uploadedAt: z.string().optional(),
  })),
})
export const OfflineSnapshotSchema = z.object({
  products: z.record(CatalogRecordSchema),
  dimensions: z.array(DimensionSchema),
  qr: z.record(QrTokenSchema, z.number().int().positive()).default({}),
  activity: z.array(ActivityFeedItemSchema),
  orders: z.record(CustomerOrderDocumentSchema),
  supplies: z.record(SupplyRequestSchema),
  plans: z.array(PlanSchema),
  profile: OfflineProfileSchema,
  mediaPaths: z.record(z.string()).optional(),
})
export const OfflineManifestSchema = z.object({
  id: z.string().uuid(),
  scopeKey: z.string(),
  version: z.string(),
  dataHash: z.string(),
  capturedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  format: z.literal(1),
  optimizedMedia: z.literal(true).optional(),
  compressedBytes: z.number().int().positive(),
  dataBytes: z.number().int().positive(),
  counts: z.record(z.number().int().nonnegative()),
  media: z.array(z.object({
    path: z.string().min(1),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive(),
  })),
})
export type OfflineManifest = z.infer<typeof OfflineManifestSchema>
export type OfflineSnapshot = z.infer<typeof OfflineSnapshotSchema>

type ResolveMedia = (media: CatalogMedia | null | undefined) => string | undefined

export function offlineSnapshotImagePaths(data: Pick<OfflineSnapshot, 'products' | 'activity' | 'orders' | 'supplies'>, resolve: ResolveMedia) {
  const urls = new Set<string>()
  const add = (media: CatalogMedia | null | undefined) => {
    const path = resolve(media)
    if (path) urls.add(path)
  }
  for (const product of Object.values(data.products)) {
    const photos = selectCatalogPhotos(product, resolve)
    add(photos.primary?.url)
    for (const photo of photos.gallery) add(photo.url)
  }
  for (const item of data.activity) {
    if (item.kind === 'order') item.productImages.forEach(add)
    else add(item.productImage)
  }
  for (const supply of Object.values(data.supplies)) add(supply.productImage)
  for (const order of Object.values(data.orders)) {
    for (const item of order.items) {
      if (typeof item.product === 'object') add(selectCatalogPhotos(item.product, resolve).primary?.url)
    }
  }
  // Snapshot plans reference products by ID, so their photos are already covered.
  return [...urls].sort()
}

export function projectOfflineHistory(
  data: Pick<OfflineSnapshot, 'activity' | 'orders' | 'supplies'>,
  resolve: ResolveMedia,
  choose: (original: string, thumbnail?: string | null) => string | undefined,
) {
  const activity: OfflineSnapshot['activity'] = data.activity.map(item => {
    if (item.kind === 'order') {
      const { productImageThumbnails, ...order } = item
      const productImages = item.productImages.flatMap(raw => {
        const original = resolve(raw)
        const selected = original && choose(original, productImageThumbnails?.[raw])
        return selected ? [selected] : []
      })
      return { ...order, productImages }
    }
    const { productImageThumbnail, ...supply } = item
    const original = resolve(supply.productImage)
    return { ...supply, productImage: (original && choose(original, productImageThumbnail)) ?? null }
  })
  const orders: OfflineSnapshot['orders'] = Object.fromEntries(Object.entries(data.orders).map(([id, order]) => [
    id, { ...order, items: order.items.map(item => {
      if (typeof item.product !== 'object') return item
      const photo = selectCatalogPhotos(item.product, resolve).primary
      const thumbnail = typeof photo?.image === 'object' ? photo.image?.sizes?.galleryThumb?.url : undefined
      return { ...item, product: { ...item.product, cover: photo ? choose(photo.url, thumbnail) : null, gallery: undefined } }
    }) },
  ]))
  const supplies: OfflineSnapshot['supplies'] = Object.fromEntries(Object.entries(data.supplies).map(([id, supply]) => {
    const { productImageThumbnail, ...details } = supply
    const original = resolve(details.productImage)
    return [id, { ...details, productImage: (original && choose(original, productImageThumbnail)) ?? null }]
  }))
  return { activity, orders, supplies }
}

export const offlineContract = {
  status: oc.input(z.object({ scopeKey: z.string(), version: z.string() })).output(z.object({
    scopeKey: z.string(),
    freshness: z.enum(['unknown', 'upToDate', 'updateAvailable']),
  })),
  manifest: oc.input(z.object({ replace: z.boolean().optional() })).output(OfflineManifestSchema),
  snapshot: oc.input(z.object({ id: z.string().uuid() })).output(z.object({ gzip: z.string() })),
}
