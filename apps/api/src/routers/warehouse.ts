import { getSalesFactor } from '@persianpart/cms/inventory'
import { authed } from '../rpc/base'
import { sdk } from '../payload'
import { getUserPermissions } from './router.helpers'
import type { WarehouseStock } from '@persianpart/cms/types'

const availability = authed.warehouse.availability.handler(async ({ input, context, errors }) => {
  const permissions = await getUserPermissions(context.user.id)
  if (permissions.disableOrdering || permissions.hideExactStock) throw errors.FORBIDDEN({ message: 'حساب کاربری شما فقط اجازهٔ مشاهدهٔ کاتالوگ را دارد.' })
  const totals = new Map<number, number>()
  for (const item of input.items) {
    const area = (totals.get(item.productId) ?? 0) + item.requestedArea
    if (area > 1_000_000) throw errors.BAD_REQUEST({ message: 'متراژ بیش از حد مجاز است.' })
    totals.set(item.productId, area)
  }
  const ids = [...totals.keys()]
  const products = await sdk.find({ collection: 'products', where: { id: { in: ids } }, limit: ids.length, depth: 0 })
  const markup = permissions.markupPercent
  const items = ids.map((productId) => {
    const product = products.docs.find((doc) => doc.id === productId)
    if (!product?.isActive) {
      throw errors.BAD_REQUEST({ message: 'یکی از کالاهای سبد قابل سفارش نیست.' })
    }
    const categoryId = typeof product.category === 'object' ? product.category?.id : product.category
    if (permissions.allowedCategoryIds.length && (!categoryId || !permissions.allowedCategoryIds.includes(Number(categoryId)))) throw errors.FORBIDDEN({ message: 'دسترسی به یکی از کالاهای سبد مجاز نیست.' })
    const factor = getSalesFactor(product)
    const requestedArea = totals.get(productId)!
    const cartonCount = Math.ceil(requestedArea / factor)
    const deliverableArea = Math.round(cartonCount * factor * 100) / 100
    const unitPrice = Math.round(Number(product.basePricePerSqm ?? 0) * (1 + markup / 100))
    return { productId, requestedArea, cartonCount, deliverableArea, sqmPerCarton: factor, productType: product.productType ?? 'tile', unit: product.productType === 'other' ? (product.unit ?? 'piece') : 'm2', unitPrice, totalPrice: Math.round(unitPrice * deliverableArea) }
  })
  const warehouses: Array<{ id: number; code: string; name: string }> = []
  let page = 1
  while (true) {
    const result = await sdk.find({ collection: 'warehouses', where: { and: [{ isActive: { equals: true } }, { stockMode: { equals: 'exact' } }] }, limit: 100, page, depth: 0 })
    const balances: Pick<WarehouseStock, 'product' | 'warehouse' | 'inventorySqm'>[] = []
    let stockPage = 1
    while (result.docs.length) {
      const stock = await sdk.find({
        collection: 'warehouse-stock',
        select: { product: true, warehouse: true, inventorySqm: true },
        where: { and: [{ warehouse: { in: result.docs.map((doc) => doc.id) } }, { product: { in: ids } }] },
        limit: 1000, page: stockPage, depth: 0,
      })
      balances.push(...stock.docs)
      if (!stock.hasNextPage) break
      stockPage++
    }
    for (const warehouse of result.docs) {
      if (items.every((item) => balances.some((balance) => {
        const productId = typeof balance.product === 'object' ? balance.product.id : balance.product
        const warehouseId = typeof balance.warehouse === 'object' ? balance.warehouse.id : balance.warehouse
        return warehouseId === warehouse.id && productId === item.productId && balance.inventorySqm >= item.deliverableArea
      }))) warehouses.push({ id: warehouse.id, code: warehouse.code, name: warehouse.name })
    }
    if (!result.hasNextPage) break
    page++
  }
  return { warehouses, items }
})

export const warehouse = { availability }
