import { handlePayloadError } from '../payload-error'
import { createHash } from 'node:crypto'
import { call } from '@orpc/server'
import { warehouse } from './warehouse'
import { sdk } from '../payload'
import { base, authed } from '../rpc/base'
import { ORPCError } from '@orpc/server'
import type { Order } from '@persianpart/cms/types'
import {
  getUserMarkupPercent,
  getUserPermissions,
  getUserProfile,
  sanitizeOrderForCustomer,
} from './router.helpers'
import {
  assertOrderAccess,
  findAndAuthorizeOrder,
  calculateOrderItemPricing,
} from './order.helpers'

const all = authed.order.all.handler(async ({ input, context }) => {
  const where: Record<string, any> = {
    user: { equals: Number(context.user.id) },
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
  const where: Record<string, any> = {
    user: { equals: Number(context.user.id) },
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

const createCustomOrder = authed.order.createCustomOrder.handler(async ({ errors }) => {
  throw errors.BAD_REQUEST({ message: 'ثبت سفارش اختصاصی فعلاً فعال نیست.' })
})

export const submit = authed.order.submit.handler(async ({ input, context, errors }) => {
  if (!input.items || input.items.length === 0) {
    throw errors.BAD_REQUEST({
      message: 'سبد سفارش نمی‌تواند خالی باشد.',
      data: { message: 'سبد سفارش نمی‌تواند خالی باشد.' },
    })
  }

  const userPerms = await getUserPermissions(context.user.id, context)
  if (userPerms.disableOrdering || userPerms.hideExactStock) {
    throw errors.FORBIDDEN({
      message: 'حساب کاربری شما در وضعیت «فقط مشاهده کاتالوگ» تنظیم شده است و امکان ثبت سفارش را ندارد.',
      data: { message: 'حساب کاربری شما در وضعیت «فقط مشاهده کاتالوگ» تنظیم شده است و امکان ثبت سفارش را ندارد.' },
    })
  }

  const idempotencyKey = input.idempotencyKey ? createHash('sha256').update(`${context.user.id}:${input.idempotencyKey.trim()}`).digest('hex') : undefined

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

  const requestedTotals = new Map<number, number>()
  for (const item of input.items) {
    const id = Number(item.productId)
    requestedTotals.set(id, (requestedTotals.get(id) ?? 0) + Number(item.requestedArea ?? item.requestedSqm))
  }
  const requestFingerprint = createHash('sha256').update(JSON.stringify({ warehouseId: input.warehouseId, items: [...requestedTotals].sort(([a], [b]) => a - b), notes: input.notes?.trim() ?? '', deliveryAddress: input.deliveryAddress?.trim() ?? null })).digest('hex')
  const assertReplay = (existing: Order) => {
    if (existing.requestFingerprint !== requestFingerprint) throw errors.CONFLICT({ message: 'کلید تکرار برای سفارش متفاوت استفاده شده است.' })
  }
  const replay = await findExistingOrder()
  if (replay) {
    assertReplay(replay)
    return sanitizeOrderForCustomer(replay)
  }

  const rawItems = input.items.map((item) => {
    const pId = Number(item.productId)
    if (!Number.isSafeInteger(pId) || pId <= 0) {
      throw errors.BAD_REQUEST({
        message: 'شناسه محصول نامعتبر است.',
        data: { message: 'شناسه محصول نامعتبر است.' },
      })
    }
    const requestedArea = Number(item.requestedArea ?? item.requestedSqm)
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

  const quote = await call(warehouse.availability, { items: rawItems.map(item => ({ productId: item.product, requestedArea: item.requestedArea })) }, { context })
  if (!quote.warehouses.some(candidate => candidate.id === input.warehouseId)) throw errors.INSUFFICIENT_STOCK({ message: 'موجودی انبار انتخاب‌شده برای تأمین کل سفارش کافی نیست.' })

  let orderDoc: Order
  try {
    orderDoc = (await sdk.create({
      collection: 'orders',
      data: {
        orderNumber: '', // Assigned authoritatively by the CMS create hook.
        trackingNumber: 0,
        user: Number(context.user.id),
        warehouse: input.warehouseId,
        requestFingerprint,
        status: 'pending',
        items: rawItems as any,
        subtotal: 0,
        finalTotal: 0,
        notes: input.notes?.trim() || '',
        deliveryAddress: (deliveryAddress || '').trim(),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    })) as Order
  } catch (err: any) {
    console.error('[ORDER SUBMIT ERROR DETAIL]:', err?.status, err?.message, JSON.stringify(err?.errors))
    // Concurrent duplicate submission won the unique constraint race: return that order
    // instead of surfacing a 500. The failed create (and its stock decrement) is rolled back.
    const racedOrder = await findExistingOrder()
    if (racedOrder) {
      assertReplay(racedOrder)
      return sanitizeOrderForCustomer(racedOrder)
    }

    handlePayloadError(err)
  }

  return sanitizeOrderForCustomer(orderDoc)
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
    return sanitizeOrderForCustomer(orderDoc)
  }

  const isAdmin = context.user.role === 'admin' || context.user.role === 'superadmin'

  if (!isAdmin) {
    // Only pending orders can be self-cancelled by regular customers
    if (orderDoc.status !== 'pending') {
      throw errors.INVALID_STATUS_TRANSITION({
        message: 'امکان لغو سفارشی که در حال پردازش یا تکمیل شده است وجود ندارد.',
      })
    }

    const deadline = new Date(orderDoc.createdAt).getTime() + 60 * 60 * 1000 // 60-minute domain rule
    if (Date.now() > deadline) {
      throw errors.CANCELLATION_DEADLINE_EXPIRED({
        message: 'مهلت ۶۰ دقیقه‌ای لغو سفارش توسط کاربر منقضی شده است. لطفاً با پشتیبانی تماس بگیرید.',
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

  const cancelled = await sdk.update({
    collection: 'orders',
    id: input.id,
    data: {
      status: isAdmin ? 'cancelled_by_admin' : 'cancelled_by_customer',
      cancelledBy: isAdmin ? 'admin' : 'customer',
      notes: updatedNotes,
    },
  }).catch(handlePayloadError)
  return sanitizeOrderForCustomer(cancelled)
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

const validateCart = authed.order.pricing.validateCart.handler(async ({ input, context }) => {
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

  const availability = await call(warehouse.availability, { items: input.items.map(item => ({ productId: Number(item.productId), requestedArea: Number(item.requestedArea ?? item.requestedSqm) })) }, { context })
  const warehouseAvailable = availability.warehouses.some(candidate => candidate.id === input.warehouseId)
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
    hasIssues: item.hasIssues || !warehouseAvailable,
    issueReason: item.issueReason ?? (!warehouseAvailable ? 'موجودی انبار انتخاب‌شده کافی نیست.' : undefined),
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
