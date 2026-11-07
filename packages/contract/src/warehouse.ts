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

export const StockImportModeSchema = z.enum(['stock', 'price', 'kimia'])
export const StockImportRowSchema = z.object({
  rowNumber: z.number().int().positive(), productUpdatedAt: z.string().datetime(), productId: z.number().int().positive(), sku: z.string().min(1), name: z.string(),
  inventorySqm: z.number().finite().nonnegative().max(1_000_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7).optional(),
  previousInventory: z.number().nullable(), revision: z.number().int().nonnegative().nullable(),
  basePricePerSqm: z.number().int().nonnegative().safe().optional(), previousPrice: z.number().nonnegative().nullable(),
})
export const StockImportPreviewInputSchema = z.object({ mode: StockImportModeSchema.default('stock'), warehouseId: z.number().int().positive().optional(), csv: z.string().min(1).max(1_000_000) }).refine(value => value.mode === 'price' || value.warehouseId !== undefined)
export const StockImportSnapshotSchema = z.object({
  mode: StockImportModeSchema, warehouseId: z.number().int().positive().optional(), actorId: z.number().int().positive(), expiresAt: z.number(),
  rows: z.array(StockImportRowSchema).min(1).max(1000),
}).superRefine((value, ctx) => {
  if (value.mode !== 'price' && !value.warehouseId) ctx.addIssue({ code: 'custom', message: 'انبار الزامی است.' })
  for (const row of value.rows) {
    if (value.mode !== 'price' && row.inventorySqm === undefined) ctx.addIssue({ code: 'custom', message: 'موجودی الزامی است.' })
    if (value.mode !== 'stock' && row.basePricePerSqm === undefined) ctx.addIssue({ code: 'custom', message: 'قیمت الزامی است.' })
  }
})
export const StockImportApplyInputSchema = z.object({ token: z.string().min(1).max(1_000_000) })
export type StockImportRow = z.infer<typeof StockImportRowSchema>
export type StockImportMode = z.infer<typeof StockImportModeSchema>
export type StockImportPreview = { token: string | null; rows: StockImportRow[]; errors: { rowNumber: number; sku: string; message: string }[]; total: number; priceChanges: number; stockChanges: number }
