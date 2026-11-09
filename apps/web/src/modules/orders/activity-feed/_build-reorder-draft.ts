import type { Order } from '@/modules/orders/order-types'
import type { Product } from '@/modules/products/product-types'

export function buildReorderDraft(items: Order['items'] | undefined, allProducts: Product[]) {
  if (!items) return { reorderProducts: [], reorderQuantities: {} }
  const products: Product[] = items.map((item) => {
    const found = allProducts.find(
      (p) => String(p.id) === String(item.productId) || p.sku === item.productSku,
    )
    if (found) return found
    return {
      id: item.productId,
      slug: item.productSlug || String(item.productId),
      name: item.productName,
      sku: item.productSku,
      dimension: item.dimension,
      dimensions: { width: 0, height: 0 },
      brand: 'پرشین پارت',
      color: '',
      grade: 'درجه ۱' as const,
      category: 'پرسلان کف' as const,
      finalCustomerPricePerSqm: item.unitPrice,
      pricePerM2: item.unitPrice,
      sqmPerCarton:
        item.deliverableArea && item.cartonCount
          ? Math.round((item.deliverableArea / item.cartonCount) * 100) / 100
          : 1.44,
      areaPerCarton:
        item.deliverableArea && item.cartonCount
          ? Math.round((item.deliverableArea / item.cartonCount) * 100) / 100
          : 1.44,
      piecesPerCarton: 4,
      tilesPerCarton: 4,
      cartonWeightKg: 25,
      inventorySqm: 9999,
      stockCartons: 999,
      inStock: true,
      stockStatus: 'in_stock' as const,
      applications: [],
      tags: [],
      images: [item.productImage || '/placeholder.png'],
      gallery: [item.productImage || '/placeholder.png'],
    }
  })
  const quantities: Record<string, number> = {}
  items.forEach((item) => {
    quantities[item.productId] = item.requestedArea || item.deliverableArea
  })
  return { reorderProducts: products, reorderQuantities: quantities }
}
