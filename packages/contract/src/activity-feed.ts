import { oc } from '@orpc/contract'
import { z } from 'zod'
import { EntityIdSchema } from './common'
import { OrderStatusSchema } from './order'
import { SupplyRequestStatusSchema } from './supply-request'

export const ActivityFeedFilterSchema = z.enum(['all', 'order', 'supply'])

export const ActivityFeedItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('order'),
    id: z.union([EntityIdSchema, z.number().int().positive()]),
    orderNumber: z.string(),
    status: OrderStatusSchema,
    statusLabel: z.string(),
    createdAt: z.string(),
    totalAmount: z.number().nonnegative(),
    itemCount: z.number().int().positive(),
    quantitySummary: z.string(),
    productImages: z.array(z.string()),
    canReorder: z.boolean(),
  }),
  z.object({
    kind: z.literal('supply'),
    id: z.union([z.number().int().positive(), EntityIdSchema]),
    requestNumber: z.string(),
    status: SupplyRequestStatusSchema,
    statusLabel: z.string(),
    createdAt: z.string(),
    estimatedTotal: z.number().nonnegative(),
    productName: z.string(),
    productImage: z.string().nullable(),
    requestedQuantity: z.number().positive(),
    roundedQuantity: z.number().positive(),
    unit: z.string(),
    packageCount: z.number().int().positive(),
    cartonsPerPallet: z.number().int().positive().nullable(),
    responseDueAt: z.string(),
    canCancel: z.boolean(),
    isOverdue: z.boolean(),
  }),
])

export type ActivityFeedItem = z.infer<typeof ActivityFeedItemSchema>

export const ActivityFeedInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  filter: ActivityFeedFilterSchema.default('all'),
  orderStatus: OrderStatusSchema.optional(),
})

export type ActivityFeedInput = z.infer<typeof ActivityFeedInputSchema>

export const ActivityFeedOutputSchema = z.object({
  items: z.array(ActivityFeedItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})

export type ActivityFeedOutput = z.infer<typeof ActivityFeedOutputSchema>


export const activityFeedContract = {
  list: oc.input(ActivityFeedInputSchema).output(ActivityFeedOutputSchema),
}
