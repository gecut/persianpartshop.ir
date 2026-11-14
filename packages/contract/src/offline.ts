import { oc } from '@orpc/contract'
import { z } from 'zod'
import { ActivityFeedItemSchema } from './activity-feed'
import { CatalogRecordSchema, DimensionSchema } from './catalog'
import { CustomerOrderDocumentSchema } from './order'
import { PlanSchema } from './plan'
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
  qr: z.record(z.string()),
  activity: z.array(ActivityFeedItemSchema),
  orders: z.record(CustomerOrderDocumentSchema),
  supplies: z.record(SupplyRequestSchema),
  plans: z.array(PlanSchema),
  profile: OfflineProfileSchema,
})
export const OfflineManifestSchema = z.object({
  id: z.string().uuid(),
  scopeKey: z.string(),
  version: z.string(),
  dataHash: z.string(),
  capturedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  format: z.literal(1),
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

export const offlineContract = {
  status: oc.input(z.object({ scopeKey: z.string(), version: z.string() })).output(z.object({
    scopeKey: z.string(),
    freshness: z.enum(['unknown', 'upToDate', 'updateAvailable']),
  })),
  manifest: oc.input(z.object({ replace: z.boolean().optional() })).output(OfflineManifestSchema),
  snapshot: oc.input(z.object({ id: z.string().uuid() })).output(z.object({ gzip: z.string() })),
}
