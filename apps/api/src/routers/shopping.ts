import { attachWarehouseStock } from './warehouse-stock.helpers'
import { call } from '@orpc/server'
import { submit } from './order'
import { sdk } from '../payload'
import { base, authed } from '../rpc/base'
import { calculateCartonMetrics } from './catalog.helpers'
import {
  fetchTaxonomy,
  finalizeOrderNumber,
  findOrderByIdOrNumber,
  getUserPermissions,
  applyProductPricing,
  sanitizeOrderForCustomer,
} from './router.helpers'

const cartProducts = base.shopping.cartProducts.handler(async ({ input, context }) => {
  if (!input || input.length === 0) return []

  const permissions = await getUserPermissions(context.user?.id)
  const products = await sdk.find({
    collection: 'products',
    where: {
      and: [
        { isActive: { equals: true } },
        ...(permissions.allowedCategoryIds.length ? [{ category: { in: permissions.allowedCategoryIds } }] : []),
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

  return (await attachWarehouseStock(products.docs)).map(prod => applyProductPricing(prod, permissions.markupPercent, permissions.hideExactStock))
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

const categories = base.shopping.categories.handler(async ({ input, context }) => {
  const permissions = await getUserPermissions(context.user?.id)
  const categories = await fetchTaxonomy('categories', { onlyActive: input?.onlyActive, sort: 'ordering' })
  return permissions.allowedCategoryIds.length ? categories.filter(category => permissions.allowedCategoryIds.includes(category.id)) : categories
})

const brands = base.shopping.brands.handler(async ({ input }) => {
  return fetchTaxonomy('brands', { onlyActive: input?.onlyActive, sort: 'name' })
})

const tags = base.shopping.tags.handler(async ({ input }) => {
  return fetchTaxonomy('tags', { onlyActive: input?.onlyActive, sort: 'name' })
})

const calculateCartons = base.shopping.calculateCartons.handler(async ({ input, context }) => {
  const permissions = await getUserPermissions(context?.user?.id)
  return calculateCartonMetrics(input, permissions.markupPercent, permissions.allowedCategoryIds)
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

  const permissions = await getUserPermissions(context.user?.id)
  if (permissions.allowedCategoryIds.length) {
    where.category = { in: input?.categoryId && !permissions.allowedCategoryIds.includes(Number(input.categoryId)) ? [-1] : input?.categoryId ? [Number(input.categoryId)] : permissions.allowedCategoryIds }
  }
  const res = await sdk.find({
    collection: 'products',
    where,
    limit: input?.limit || 50,
    page: input?.page || 1,
    depth: 2,
  })

  const items = (await attachWarehouseStock(res.docs)).map(prod => applyProductPricing(prod, permissions.markupPercent, permissions.hideExactStock))

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
  const permissions = await getUserPermissions(context.user?.id)
  const categoryId = typeof prod.category === 'object' ? prod.category?.id : prod.category
  if (permissions.allowedCategoryIds.length && !permissions.allowedCategoryIds.includes(Number(categoryId))) return null
  return applyProductPricing((await attachWarehouseStock([prod]))[0]!, permissions.markupPercent, permissions.hideExactStock)
})

const createOrder = authed.shopping.createOrder.handler(async ({ input, context }) => call(submit, input, { context }))

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
