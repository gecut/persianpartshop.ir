import { getSalesFactor } from '@persianpart/cms/inventory'
import type { Product } from '@persianpart/cms/types'
import { sdk } from '../payload'

// Catalog hints use the largest single active warehouse balance, never a sum.
export async function attachWarehouseStock(products: Product[]) {
  const maximum = new Map<number, number>()
  const supplied = new Set<number>()
  if (products.length) {
    let page = 1
    while (true) {
      const result = await sdk.find({ collection: 'warehouse-stock', select: { product: true, warehouse: true, inventorySqm: true }, where: { and: [
        { product: { in: products.map(product => product.id) } }, { 'warehouse.isActive': { equals: true } }, { 'warehouse.stockMode': { equals: 'exact' } },
      ] }, depth: 0, page, limit: 1000 })
      for (const balance of result.docs) {
        const id = typeof balance.product === 'object' ? balance.product.id : balance.product
        maximum.set(id, Math.max(maximum.get(id) ?? 0, Number(balance.inventorySqm) || 0))
      }
      if (!result.hasNextPage) break
      page++
    }
    page = 1
    while (true) {
      const result = await sdk.find({ collection: 'warehouse-stock', select: { product: true }, where: { and: [
        { product: { in: products.map(product => product.id) } }, { isActive: { equals: true } },
        { 'warehouse.isActive': { equals: true } }, { 'warehouse.stockMode': { equals: 'inquiry' } },
      ] }, depth: 0, page, limit: 1000 })
      for (const source of result.docs) supplied.add(typeof source.product === 'object' ? source.product.id : source.product)
      if (!result.hasNextPage) break
      page++
    }
  }
  return products.map(product => {
    const inventorySqm = maximum.get(product.id) ?? 0
    const stockCartons = product.productType === 'other' ? inventorySqm : Math.floor(Math.round(inventorySqm * 100) / Math.round(getSalesFactor(product) * 100))
    return { ...product, hasSupplySource: supplied.has(product.id), cartonsPerPallet: product.productType === 'other' ? null : product.cartonsPerPallet ?? null, inventorySqm, stockCartons, availability: stockCartons > 0 ? 'available' : 'out_of_stock' }
  })
}
