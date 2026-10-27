import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import { z } from 'zod'
import {
  EntityIdSchema,
  PaginationInputSchema,
  createPaginatedResponseSchema,
} from './common'

// ============================================================================
// 1. Cart Validation & Pricing Quote Schemas
// ============================================================================

export const CartItemInputSchema = z.object({
  productId: z.union([EntityIdSchema, z.number().int().positive()]),
  requestedSqm: z.number().positive('متراژ باید بزرگتر از صفر باشد').finite().optional(),
  requestedArea: z.number().positive('متراژ باید بزرگتر از صفر باشد').finite().optional(),
})

export type CartItemInput = z.infer<typeof CartItemInputSchema>

export const ValidateCartInputSchema = z.object({
  items: z.array(CartItemInputSchema).min(1, 'سبد خرید نمی‌تواند خالی باشد'),
})

export type ValidateCartInput = z.infer<typeof ValidateCartInputSchema>

export const ValidatedCartItemSchema = z.object({
  productId: EntityIdSchema,
  sku: z.string(),
  productName: z.string(),
  cover: z.string().optional().nullable(),
  requestedSqm: z.number().positive(),
  cartonCount: z.number().int().positive(),
  sqmPerCarton: z.number().positive(),
  actualSqm: z.number().positive(),
  pricePerSqm: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  inStock: z.boolean(),
  availableInventorySqm: z.number().nonnegative(),
})

export type ValidatedCartItem = z.infer<typeof ValidatedCartItemSchema>

export const ValidateCartOutputSchema = z.object({
  items: z.array(ValidatedCartItemSchema),
  totalAmount: z.number().nonnegative(),
  totalSqm: z.number().nonnegative(),
  totalCartons: z.number().int().nonnegative(),
  isValid: z.boolean(),
  errorReasons: z.array(z.string()),
})

export type ValidateCartOutput = z.infer<typeof ValidateCartOutputSchema>

// ============================================================================
// 2. Order & Historical Snapshot Schemas
// ============================================================================

export const OrderStatusSchema = z.enum([
  'pending',
  'approve',
  'cancel',
  'checking',
  'approved',
  'preparing',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_admin',
  'cancelled',
  // Backwards compatibility aliases
  'pending_review',
  'confirmed',
  'ready',
  'processing',
])

export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderItemSnapshotSchema = z.object({
  id: EntityIdSchema,
  orderId: EntityIdSchema,
  productId: EntityIdSchema,

  sku: z.string(),
  productName: z.string(),

  requestedSqm: z.number().positive(),
  cartonCount: z.number().int().positive(),
  sqmPerCarton: z.number().positive(),
  actualSqm: z.number().positive(),

  basePricePerSqm: z.number().nonnegative(),
  customerTypeId: EntityIdSchema,
  customerTypeName: z.string(),
  markupPercent: z.number(),

  finalPricePerSqm: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
})

export type OrderItemSnapshot = z.infer<typeof OrderItemSnapshotSchema>

export const TimelineActorTypeSchema = z.enum(['customer', 'admin', 'system'])
export type TimelineActorType = z.infer<typeof TimelineActorTypeSchema>

export const TimelineEventTypeSchema = z.enum([
  'order_created',
  'status_changed',
  'customer_cancelled',
  'admin_cancelled',
  'order_completed',
])

export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>

export const OrderTimelineEventSchema = z.object({
  id: EntityIdSchema,
  orderId: EntityIdSchema,
  eventType: TimelineEventTypeSchema,
  actorType: TimelineActorTypeSchema,
  actorId: EntityIdSchema,
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export type OrderTimelineEvent = z.infer<typeof OrderTimelineEventSchema>

export const OrderSchema = z.object({
  id: EntityIdSchema,
  customerId: EntityIdSchema,
  customerStoreName: z.string().optional(),
  status: OrderStatusSchema,
  items: z.array(OrderItemSnapshotSchema),
  totalAmount: z.number().nonnegative(),
  totalSqm: z.number().nonnegative(),
  totalCartons: z.number().int().nonnegative(),
  notes: z.string().optional(),
  cancellationDeadline: z.string().optional(),
  timeline: z.array(OrderTimelineEventSchema),
  cancellationReason: z.string().optional(),
  cancellationNote: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Order = z.infer<typeof OrderSchema>

export const SubmitOrderInputSchema = z.object({
  items: z.array(CartItemInputSchema).min(1, 'سبد خرید جهت ثبت سفارش الزامی است'),
  notes: z.string().trim().max(1000).optional(),
  deliveryAddress: z.string().trim().max(1000).optional(),
})

export type SubmitOrderInput = z.infer<typeof SubmitOrderInputSchema>

export const CustomerOrderFilterInputSchema = PaginationInputSchema.extend({
  status: OrderStatusSchema.optional(),
})

export type CustomerOrderFilterInput = z.infer<typeof CustomerOrderFilterInputSchema>

export const CustomerCancelOrderInputSchema = z.object({
  id: z.union([EntityIdSchema, z.number().int().positive()]),
  reason: z.string().trim().max(500).optional(),
})

export type CustomerCancelOrderInput = z.infer<typeof CustomerCancelOrderInputSchema>

export const ReorderItemStatusSchema = z.enum(['ready', 'changed', 'unavailable', 'out_of_stock'])

export const ReorderComparisonItemSchema = z.object({
  productId: EntityIdSchema,
  sku: z.string(),
  productName: z.string(),
  status: ReorderItemStatusSchema,
  requestedSqm: z.number(),
  currentPricePerSqm: z.number().optional(),
  historicalPricePerSqm: z.number(),
  currentSqmPerCarton: z.number().optional(),
  historicalSqmPerCarton: z.number(),
  availableStockSqm: z.number(),
  cartItem: ValidatedCartItemSchema.optional(),
})

export const PrepareReorderOutputSchema = z.object({
  originalOrderId: EntityIdSchema,
  items: z.array(ReorderComparisonItemSchema),
  canSubmitDirectly: z.boolean(),
  notes: z.string().optional(),
})

export type PrepareReorderOutput = z.infer<typeof PrepareReorderOutputSchema>

// ============================================================================
// 3. Unified Order & Pricing Contract
// ============================================================================

export const pricingContract = {
  validateCart: oc
    .meta(openapi({ method: 'POST', path: '/pricing/validate-cart', summary: 'اعتبارسنجی سبد خرید و محاسبه کارتن و قیمت نهایی' }))
    .input(ValidateCartInputSchema)
    .output(
      ValidateCartOutputSchema.or(
        z.object({
          items: z.array(z.any()),
          subtotal: z.number().optional(),
          finalTotal: z.number().optional(),
          discountAmount: z.number().optional(),
          taxAmount: z.number().optional(),
          hasBlockingIssues: z.boolean().optional(),
        })
      ).or(z.any())
    )
    .errors({
      UNAUTHORIZED: {},
    }),
}

export const orderContract = {
  all: oc
    .meta(openapi({ method: 'GET', path: '/orders/all', summary: 'دریافت تمامی سفارش‌های کاربر' }))
    .input(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(100).optional(),
          page: z.coerce.number().int().min(1).default(1).optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .output(z.array(z.any()).or(createPaginatedResponseSchema(OrderSchema)).or(z.any())),

  list: oc
    .meta(openapi({ method: 'GET', path: '/orders', summary: 'دریافت تاریخچه سفارش‌های مشتری جاری' }))
    .input(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
          page: z.coerce.number().int().min(1).default(1).optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .output(z.array(z.any()).or(createPaginatedResponseSchema(OrderSchema)).or(z.any()))
    .errors({
      UNAUTHORIZED: {},
    }),

  summary: oc
    .meta(openapi({ method: 'GET', path: '/orders/summary', summary: 'خلاصه وضعیت سفارش‌های کاربر' }))
    .output(
      z.object({
        total: z.number(),
        processing: z.number(),
        completed: z.number(),
      })
    ),

  detail: oc
    .meta(openapi({ method: 'GET', path: '/orders/detail', summary: 'مشاهده جزییات سفارش' }))
    .input(
      z.object({
        orderId: z.union([EntityIdSchema, z.number().int().positive()]).optional(),
        id: z.union([EntityIdSchema, z.number().int().positive()]).optional(),
      })
    )
    .output(OrderSchema.or(z.any()))
    .errors({
      UNAUTHORIZED: {},
      NOT_FOUND: {},
      BAD_REQUEST: {},
    }),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/orders/{id}', summary: 'مشاهده جزییات سفارش و تایم‌لاین توسط مشتری' }))
    .input(z.object({ id: z.union([EntityIdSchema, z.number().int().positive()]) }))
    .output(OrderSchema.or(z.any()))
    .errors({
      UNAUTHORIZED: {},
      NOT_FOUND: {},
      BAD_REQUEST: {},
    }),

  createCustomOrder: oc
    .meta(openapi({ method: 'POST', path: '/orders/custom', summary: 'ثبت سفارش اختصاصی' }))
    .input(
      z.object({
        productType: z.string().optional(),
        contentType: z.string().optional(),
        notes: z.string().optional(),
        details: z.any().optional(),
      })
    )
    .output(
      z.object({
        id: z.union([EntityIdSchema, z.number()]),
        message: z.string(),
      })
    ),

  submit: oc
    .meta(openapi({ method: 'POST', path: '/orders', summary: 'ثبت سفارش قطعی تراکنشی توسط مشتری' }))
    .input(SubmitOrderInputSchema)
    .output(OrderSchema.or(z.any()))
    .errors({
      UNAUTHORIZED: {},
      INSUFFICIENT_STOCK: {},
      BAD_REQUEST: {},
    }),

  cancel: oc
    .meta(openapi({ method: 'POST', path: '/orders/{id}/cancel', summary: 'لغو مستقیم سفارش توسط مشتری قبل از انقضای مهلت' }))
    .input(CustomerCancelOrderInputSchema)
    .output(OrderSchema.or(z.any()))
    .errors({
      UNAUTHORIZED: {},
      NOT_FOUND: {},
      CANCELLATION_DEADLINE_EXPIRED: {},
      INVALID_STATUS_TRANSITION: {},
      BAD_REQUEST: {},
    }),

  prepareReorder: oc
    .meta(openapi({ method: 'POST', path: '/orders/{id}/reorder', summary: 'آماده‌سازی سبد خرید مجدد بر اساس سفارش تاریخی و اعتبارسنجی قیمت و موجودی روز' }))
    .input(z.object({ id: z.union([EntityIdSchema, z.number().int().positive()]) }))
    .output(PrepareReorderOutputSchema.or(z.any()))
    .errors({
      UNAUTHORIZED: {},
      NOT_FOUND: {},
      BAD_REQUEST: {},
    }),

  pricing: pricingContract,
}
