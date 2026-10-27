import { sdk } from '../payload'
import { base, authed } from '../rpc/base'
import { calculateCartonMetrics } from './catalog.helpers'
import {
  fetchTaxonomy,
  finalizeOrderNumber,
  findOrderByIdOrNumber,
  getUserMarkupPercent,
  applyProductPricing,
  sanitizeOrderForCustomer,
} from './router.helpers'

const cartProducts = base.shopping.cartProducts.handler(async ({ input, context }) => {
  if (!input || input.length === 0) return []

  const products = await sdk.find({
    collection: 'products',
    where: {
      and: [
        { isActive: { equals: true } },
        {
          or: input.map((id) => ({
            id: { equals: isNaN(Number(id)) ? id : Number(id) },
          })),
        },
      ],
    },
    limit: 100,
    depth: 2,
  })

  const markupPercent = await getUserMarkupPercent(context?.user?.id)
  return products.docs.map((prod: any) => applyProductPricing(prod, markupPercent))
})

const addressList = authed.shopping.addressList.handler(async ({ context }) => {
  const userDoc: any = await sdk.findByID({ collection: 'users', id: context.user.id })
  return userDoc?.addresses || []
})

const mutateAddress = authed.shopping.mutateAddress.handler(async ({ input, context }) => {
  const userDoc: any = await sdk.findByID({ collection: 'users', id: context.user.id })
  const currentAddresses: any[] = userDoc?.addresses || []

  let updatedAddresses: any[]
  if (input.id) {
    updatedAddresses = currentAddresses.map((addr) =>
      addr.id === input.id ? { ...addr, ...input } : addr
    )
  } else {
    const newAddress = {
      ...input,
      id: `addr_${Date.now()}`,
    }
    updatedAddresses = [...currentAddresses, newAddress]
  }

  const updatedUser: any = await sdk.update({
    collection: 'users',
    id: context.user.id,
    data: {
      addresses: updatedAddresses,
    },
  })

  return updatedUser.addresses || []
})

const categories = base.shopping.categories.handler(async ({ input }) => {
  return fetchTaxonomy('categories', { onlyActive: input?.onlyActive, sort: 'ordering' })
})

const brands = base.shopping.brands.handler(async ({ input }) => {
  return fetchTaxonomy('brands', { onlyActive: input?.onlyActive, sort: 'name' })
})

const tags = base.shopping.tags.handler(async ({ input }) => {
  return fetchTaxonomy('tags', { onlyActive: input?.onlyActive, sort: 'name' })
})

const calculateCartons = base.shopping.calculateCartons.handler(async ({ input, context }) => {
  const markupPercent = await getUserMarkupPercent(context?.user?.id)
  return calculateCartonMetrics(input, markupPercent)
})

const all = base.shopping.all.handler(async ({ input, context }) => {
  const where: Record<string, any> = {
    isActive: { equals: true },
  }

  if (input?.search) {
    where.name = { contains: input.search }
  }
  if (input?.categoryId) {
    where.category = { equals: input.categoryId }
  }
  if (input?.brandId) {
    where.brand = { equals: input.brandId }
  }

  const res = await sdk.find({
    collection: 'products',
    where,
    limit: input?.limit || 50,
    page: input?.page || 1,
    depth: 2,
  })

  const markupPercent = await getUserMarkupPercent(context?.user?.id)
  const items = res.docs.map((prod: any) => applyProductPricing(prod, markupPercent))

  return {
    ...res,
    docs: items,
  }
})

const detail = base.shopping.detail.handler(async ({ input, context }) => {
  const prod: any = await sdk.findByID({
    collection: 'products',
    id: input.id,
    depth: 2,
  })

  if (!prod || prod.isActive === false) return null
  const markupPercent = await getUserMarkupPercent(context?.user?.id)
  return applyProductPricing(prod, markupPercent)
})

const createOrder = authed.shopping.createOrder.handler(async ({ input, context, errors }) => {
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw errors.BAD_REQUEST({ message: 'سبد سفارش نمی‌تواند خالی باشد.' })
  }

  const idempotencyKey = (input as any).idempotencyKey
  if (idempotencyKey) {
    const existing = await sdk.find({
      collection: 'orders',
      where: {
        and: [
          { user: { equals: Number(context.user.id) } },
          { idempotencyKey: { equals: String(idempotencyKey) } },
        ],
      },
      limit: 1,
      depth: 2,
    })
    if (existing.docs.length > 0) {
      return sanitizeOrderForCustomer(existing.docs[0])
    }
  }

  // Pass raw products & requested areas to CMS — CMS is authoritative for calculation & reservation
  const rawItems = input.items.map((item: any) => {
    const pId = Number(item.productId || item.product)
    if (isNaN(pId) || pId <= 0) {
      throw errors.BAD_REQUEST({ message: 'شناسه محصول نامعتبر است.' })
    }
    const requestedArea = Math.max(0.01, Number(item.requestedArea || item.requestedSqm || 1))
    return {
      product: pId,
      requestedArea,
    }
  })

  const tempOrderNumber = `ptp ${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`

  const order = await sdk.create({
    collection: 'orders',
    data: {
      orderNumber: tempOrderNumber,
      user: Number(context.user.id),
      status: 'pending',
      items: rawItems as any,
      subtotal: 0,
      finalTotal: 0,
      notes: input.notes || '',
      ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : {}),
    },
  })

  return sanitizeOrderForCustomer(order)
})

const verifyPayment = authed.shopping.verifyPayment.handler(async ({ input, context, errors }) => {
  if (!input?.orderId) {
    throw errors.BAD_REQUEST({ message: 'شناسه سفارش نامعتبر است.' })
  }

  const orderDoc: any = await findOrderByIdOrNumber(input.orderId, 1)
  if (!orderDoc) {
    throw errors.NOT_FOUND({ message: 'سفارش مورد نظر یافت نشد.' })
  }

  const orderUserId =
    typeof orderDoc.user === 'object' && orderDoc.user !== null
      ? orderDoc.user.id
      : orderDoc.user

  if (orderUserId != context.user.id && context.user.role !== 'admin' && context.user.role !== 'superadmin') {
    throw errors.NOT_FOUND({ message: 'سفارش مورد نظر یافت نشد.' })
  }

  return {
    verified: true,
    message: 'سفارش معتبر و در حال پردازش است.',
    orderId: input.orderId,
  }
})

export const shopping = base.shopping.router({
  cartProducts,
  addressList,
  mutateAddress,
  categories,
  brands,
  tags,
  calculateCartons,
  all,
  detail,
  createOrder,
  verifyPayment,
})
