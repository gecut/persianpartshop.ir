import { sdk } from '../payload'
import { base, authed } from '../rpc/base'
import type { Order } from '@persianpart/cms/types'
import {
  finalizeOrderNumber,
  getUserMarkupPercent,
  getUserProfile,
  sanitizeOrderForCustomer,
} from './router.helpers'
import {
  assertOrderAccess,
  findAndAuthorizeOrder,
  generateTempOrderNumber,
  calculateOrderItemPricing,
} from './order.helpers'

const all = authed.order.all.handler(async ({ input, context }) => {
  const isAdmin = context.user.role === 'admin' || context.user.role === 'superadmin'
  const where: Record<string, any> = {}

  // Invariant: Non-admins are strictly isolated to their own user ID
  if (!isAdmin) {
    where.user = { equals: Number(context.user.id) }
  }
  if (input?.status) {
    where.status = { equals: input.status }
  }

  const limit = Math.min(Math.max(1, Number(input?.limit) || 100), 100)
  const page = Math.max(1, Number(input?.page) || 1)

  const allOrders = await sdk.find({
    collection: 'orders',
    where,
    limit,
    page,
    depth: 2,
    sort: '-createdAt',
  })

  return allOrders.docs.map(sanitizeOrderForCustomer) as Order[]
})

const list = authed.order.list.handler(async ({ input, context }) => {
  const isAdmin = context.user.role === 'admin' || context.user.role === 'superadmin'
  const where: Record<string, any> = {}

  // Invariant: Non-admins are strictly isolated to their own user ID
  if (!isAdmin) {
    where.user = { equals: Number(context.user.id) }
  }
  if (input?.status) {
    where.status = { equals: input.status }
  }

  const limit = Math.min(Math.max(1, Number(input?.limit) || 50), 100)
  const page = Math.max(1, Number(input?.page) || 1)

  const res = await sdk.find({
    collection: 'orders',
    where,
    limit,
    page,
    depth: 2,
    sort: '-createdAt',
  })

  return {
    items: res.docs.map(sanitizeOrderForCustomer) as Order[],
    total: res.totalDocs,
    page,
    limit,
    totalPages: Math.ceil(res.totalDocs / limit) || 1,
  }
})

const summary = authed.order.summary.handler(async ({ context }) => {
  const userId = Number(context.user.id)
  const getOrderCount = async (status?: string) => {
    const { totalDocs } = await sdk.count({
      collection: 'orders',
      where: {
        user: { equals: userId },
        ...(status ? { status: { equals: status } } : {}),
      },
    })
    return totalDocs
  }

  const [total, processing, completed] = await Promise.all([
    getOrderCount(),
    getOrderCount('pending'),
    getOrderCount('completed'),
  ])

  return { total, processing, completed }
})

const detail = authed.order.detail.handler(async ({ input, context, errors }) => {
  const rawId = input.orderId ?? input.id ?? ''
  const doc = await findAndAuthorizeOrder(rawId, context.user, 2, errors)
  return sanitizeOrderForCustomer(doc)
})

const getById = authed.order.getById.handler(async ({ input, context, errors }) => {
  const doc = await findAndAuthorizeOrder(input.id, context.user, 2, errors)
  return sanitizeOrderForCustomer(doc)
})

const createCustomOrder = authed.order.createCustomOrder.handler(
  async ({ input, context }) => {
    const tempOrderNumber = generateTempOrderNumber()
    const orderDoc = (await sdk.create({
      collection: 'orders',
      data: {
        orderNumber: tempOrderNumber,
        user: Number(context.user.id),
        status: 'pending',
        items: [],
        subtotal: 0,
        finalTotal: 0,
        notes: `[سفارش اختصاصی - ${input.productType || 'عمومی'}]: ${input.notes || ''}`,
      },
    })) as Order

    const finalized = await finalizeOrderNumber(orderDoc)
    return { id: finalized.id, message: 'سفارش اختصاصی با موفقیت ثبت شد' }
  }
)

const submit = authed.order.submit.handler(async ({ input, context, errors }) => {
  if (!input.items || input.items.length === 0) {
    throw errors.BAD_REQUEST({ message: 'سبد سفارش نمی‌تواند خالی باشد.' })
  }

  const idempotencyKey = input.idempotencyKey?.trim()

  const findExistingOrder = async () => {
    if (!idempotencyKey) return null
    const existing = await sdk.find({
      collection: 'orders',
      where: {
        and: [
          { user: { equals: Number(context.user.id) } },
          { idempotencyKey: { equals: idempotencyKey } },
        ],
      },
      limit: 1,
      depth: 2,
    })
    return existing.docs[0] ?? null
  }

  const replay = await findExistingOrder()
  if (replay) {
    return sanitizeOrderForCustomer(replay) as Order
  }

  const rawItems = input.items.map((item) => {
    const pId = Number(item.productId)
    if (isNaN(pId) || pId <= 0) {
      throw errors.BAD_REQUEST({ message: 'شناسه محصول نامعتبر است.' })
    }
    const requestedArea = Math.max(0.01, Number(item.requestedArea || item.requestedSqm || 1))
    return {
      product: pId,
      requestedArea,
    }
  })

  let deliveryAddress = input.deliveryAddress
  if (!deliveryAddress) {
    try {
      const userProfile: any = await getUserProfile(context.user.id)
      deliveryAddress = userProfile?.address || ''
    } catch {
      deliveryAddress = ''
    }
  }

  const tempOrderNumber = generateTempOrderNumber()

  let orderDoc: Order
  try {
    orderDoc = (await sdk.create({
      collection: 'orders',
      data: {
        orderNumber: tempOrderNumber,
        user: Number(context.user.id),
        status: 'pending',
        items: rawItems as any,
        subtotal: 0,
        finalTotal: 0,
        notes: input.notes?.trim() || '',
        deliveryAddress: (deliveryAddress || '').trim(),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    })) as Order
  } catch (err) {
    // Concurrent duplicate submission won the unique constraint race: return that order
    // instead of surfacing a 500. The failed create (and its stock decrement) is rolled back.
    const racedOrder = await findExistingOrder()
    if (racedOrder) {
      return sanitizeOrderForCustomer(racedOrder) as Order
    }
    throw err
  }

  return sanitizeOrderForCustomer(orderDoc) as Order
})

const cancel = authed.order.cancel.handler(async ({ input, context, errors }) => {
  let orderDoc: Order | null = null
  try {
    orderDoc = (await sdk.findByID({
      collection: 'orders',
      id: Number(input.id),
      depth: 0,
    })) as Order | null
  } catch {
    orderDoc = null
  }

  if (!orderDoc) {
    throw errors.NOT_FOUND()
  }

  assertOrderAccess(orderDoc, context.user, errors)

  // Idempotency: if already cancelled, return existing document
  if (
    orderDoc.status === 'cancel' ||
    orderDoc.status === 'cancelled_by_customer' ||
    orderDoc.status === 'cancelled_by_admin'
  ) {
    return orderDoc
  }

  const isAdmin = context.user.role === 'admin' || context.user.role === 'superadmin'

  if (!isAdmin) {
    // Only pending orders can be self-cancelled by regular customers
    if (orderDoc.status !== 'pending') {
      throw errors.INVALID_STATUS_TRANSITION({
        message: 'امکان لغو سفارشی که در حال پردازش یا تکمیل شده است وجود ندارد.',
      })
    }

    const deadline = new Date(orderDoc.createdAt).getTime() + 30 * 60 * 1000 // 30-minute domain rule
    if (Date.now() > deadline) {
      throw errors.CANCELLATION_DEADLINE_EXPIRED({
        message: 'مهلت ۳۰ دقیقه‌ای لغو سفارش توسط کاربر منقضی شده است. لطفاً با پشتیبانی تماس بگیرید.',
      })
    }
  }

  // Prevent wiping existing notes; append cancellation reason cleanly
  const cancellationLabel = isAdmin ? 'لغو توسط مدیریت' : 'لغو توسط کاربر'
  const cancellationText = input.reason?.trim()
    ? `[${cancellationLabel}: ${input.reason.trim()}]`
    : `[${cancellationLabel}]`

  const existingNotes = orderDoc.notes ? orderDoc.notes.trim() : ''
  const updatedNotes = existingNotes ? `${existingNotes}\n${cancellationText}` : cancellationText

  return sdk.update({
    collection: 'orders',
    id: input.id,
    data: {
      status: isAdmin ? 'cancelled_by_admin' : 'cancelled_by_customer',
      cancelledBy: isAdmin ? 'admin' : 'customer',
      notes: updatedNotes,
    },
  })
})

const prepareReorder = authed.order.prepareReorder.handler(async ({ input, context, errors }) => {
  let orderDoc: Order | null = null
  try {
    orderDoc = (await sdk.findByID({
      collection: 'orders',
      id: Number(input.id),
      depth: 2,
    })) as Order | null
  } catch {
    orderDoc = null
  }

  if (!orderDoc) {
    throw errors.NOT_FOUND()
  }

  assertOrderAccess(orderDoc, context.user, errors)

  const items = (orderDoc.items || [])
    .map((i: any) => {
      const pId = typeof i.product === 'object' && i.product !== null ? i.product.id : i.product
      return {
        productId: String(pId),
        requestedSqm: Number(i.requestedArea || i.deliverableArea || 1),
      }
    })
    .filter((i) => !isNaN(Number(i.productId)) && Number(i.productId) > 0)

  return {
    orderId: String(orderDoc.id),
    items,
  }
})

const validateCart = base.order.pricing.validateCart.handler(async ({ input, context }) => {
  const markupPercent = await getUserMarkupPercent(context?.user?.id)

  const calculatedItems = await Promise.all(
    input.items.map((item) =>
      calculateOrderItemPricing(
        item.productId,
        item.requestedArea,
        item.requestedSqm,
        markupPercent
      )
    )
  )

  const subtotal = calculatedItems.reduce((acc, cur) => acc + cur.totalPrice, 0)

  const validatedItems = calculatedItems.map((item) => ({
    productId: String(item.productId),
    sku: item.sku,
    productName: item.productName,
    requestedArea: item.requestedArea,
    cartonCount: item.cartonCount,
    deliverableArea: item.deliverableArea,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    hasIssues: item.hasIssues,
    issueReason: item.issueReason,
  }))

  return {
    items: validatedItems,
    subtotal,
    discountAmount: 0,
    taxAmount: 0,
    finalTotal: subtotal,
    hasBlockingIssues: validatedItems.some((i) => i.hasIssues),
  }
})

export const order = base.order.router({
  all,
  list,
  summary,
  detail,
  getById,
  createCustomOrder,
  submit,
  cancel,
  prepareReorder,
  pricing: {
    validateCart,
  },
})
