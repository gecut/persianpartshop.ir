import { oc } from '@orpc/contract'
import { z } from 'zod'

export const WarehouseSummarySchema = z.object({
  id: z.number().int().positive(), code: z.string(), name: z.string(),
})

export type WarehouseSummary = z.infer<typeof WarehouseSummarySchema>

export const WarehouseAvailabilityInputSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    requestedArea: z.number().positive().max(1_000_000),
  })).min(1).max(100),
})

export const warehouseContract = {
  availability: oc.input(WarehouseAvailabilityInputSchema).output(z.object({
    warehouses: z.array(WarehouseSummarySchema),
    items: z.array(z.object({
      productId: z.number().int().positive(), requestedArea: z.number().positive(),
      cartonCount: z.number().int().positive(), deliverableArea: z.number().positive(),
      productType: z.enum(['tile', 'other']), unit: z.string(),
      sqmPerCarton: z.number().positive(), unitPrice: z.number().nonnegative(), totalPrice: z.number().nonnegative(),
    })),
  })).errors({ BAD_REQUEST: {}, UNAUTHORIZED: {}, FORBIDDEN: {} }),
}

export const StockImportRowSchema = z.object({
  productUpdatedAt: z.string().datetime(), productId: z.number().int().positive(), sku: z.string().min(1),
  inventorySqm: z.number().finite().nonnegative().max(1_000_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7),
  revision: z.number().int().nonnegative().nullable(),
})
export const StockImportPreviewInputSchema = z.object({ warehouseId: z.number().int().positive(), csv: z.string().min(1).max(1_000_000) })
export const StockImportSnapshotSchema = z.object({
  warehouseId: z.number().int().positive(), actorId: z.number().int().positive(), expiresAt: z.number(),
  rows: z.array(StockImportRowSchema).min(1).max(1000),
})
export const StockImportApplyInputSchema = z.object({ token: z.string().min(1).max(1_000_000) })
export type StockImportRow = z.infer<typeof StockImportRowSchema>
