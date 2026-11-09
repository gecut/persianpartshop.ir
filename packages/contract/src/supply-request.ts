import { oc } from '@orpc/contract'
import { z } from 'zod'

const id = z.number().int().positive().safe()
const quantity = z.number().finite().positive().max(1_000_000).refine(value => Math.round(value * 100) > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)
const integer = z.number().int().nonnegative().safe()
export const SupplyRequestStatusSchema = z.enum(['new', 'reviewing', 'supplied', 'unavailable', 'cancelled_by_customer'])
export const SupplyPreviewInputSchema = z.object({ productId: id, requestedQuantity: quantity })
export const SupplyWarehouseSchema = z.object({ id, code: z.string(), name: z.string() })
export const SupplyQuoteSchema = z.object({ productId: id, productType: z.enum(['tile', 'other']), unit: z.string(), requestedQuantity: quantity, packageCount: id, roundedQuantity: z.number().finite().positive(), salesFactor: z.number().finite().positive(), cartonsPerPallet: id.nullable(), estimatedUnitPrice: integer, estimatedTotal: integer })
export const SupplyRequestSchema = z.object({
  id,
  requestNumber: z.string(),
  status: SupplyRequestStatusSchema,
  productId: id,
  productName: z.string(),
  productSku: z.string(),
  productImage: z.string().nullable(),
  warehouseId: id.nullable(),
  warehouseName: z.string().nullable(),
  warehouseCode: z.string().nullable(),
  productType: z.enum(['tile', 'other']),
  unit: z.string(),
  requestedQuantity: quantity,
  packageCount: id,
  roundedQuantity: z.number().finite().positive(),
  salesFactor: z.number().finite().positive(),
  cartonsPerPallet: id.nullable(),
  estimatedUnitPrice: integer,
  estimatedTotal: integer,
  notes: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  responseDueAt: z.string().datetime(),
  reviewStartedAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  canCancel: z.boolean(),
  isOverdue: z.boolean(),
})
export type SupplyRequest = z.infer<typeof SupplyRequestSchema>
export const SupplySubmitInputSchema = SupplyPreviewInputSchema.extend({
  warehouseId: id.optional(),
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().uuid(),
})
const errors = { BAD_REQUEST: {}, UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {}, CONFLICT: {}, EXACT_STOCK_AVAILABLE: {}, SOURCE_UNAVAILABLE: {}, CANNOT_CANCEL: {} }
export const supplyRequestContract = {
  preview: oc.input(SupplyPreviewInputSchema).output(z.object({ eligible: z.boolean(), reason: z.enum(['exact_stock_available', 'no_active_source']).nullable(), warehouses: z.array(SupplyWarehouseSchema).optional(), quote: SupplyQuoteSchema })).errors(errors),
  submit: oc.input(SupplySubmitInputSchema).output(SupplyRequestSchema).errors(errors),
  list: oc.input(z.object({ page: id.default(1), limit: z.number().int().min(1).max(100).default(20), status: SupplyRequestStatusSchema.optional() })).output(z.object({ items: z.array(SupplyRequestSchema), total: integer, page: id, limit: id, totalPages: integer })).errors(errors),
  detail: oc.input(z.object({ id })).output(SupplyRequestSchema).errors(errors),
  cancel: oc.input(z.object({ id })).output(SupplyRequestSchema).errors(errors),
}
