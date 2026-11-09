import { summarizeQuantities } from '../../lib/utils/unit'
import type { Product } from '../../types'
import { useCatalogIds } from '../products/catalog-data'
import { selectionStore, useProductSelection } from '../products/selection-store'

export interface CartItem {
  productType: 'tile' | 'other'; unit: string; productId: string; name: string; slug: string; sku: string; dimension: string; image: string
  unitPrice: number; oldUnitPrice?: number; sqmPerCarton: number; areaPerCarton: number
  requestedArea: number; cartonCount: number; deliverableArea: number; totalPrice: number
  cartonsPerPallet?: number | null
  stockCartons: number; inventorySqm: number; statusWarning?: 'low_stock' | 'out_of_stock' | 'price_changed'
}
export type CartDemoMode = 'normal' | 'low_stock' | 'out_of_stock' | 'price_changed' | 'empty'
export const cartStore = {
  addItem: async (product: Product, requestedArea: number) => {
    await selectionStore.setQuantity(product.id, requestedArea)
    const draft = selectionStore.getSnapshot()
    return Boolean(!draft.error && draft.quantities[product.id] === requestedArea)
  },
  setProductQuantity: (product: Product, requestedArea: number) => selectionStore.setQuantity(product.id, requestedArea),
  updateRequestedArea: (id: string, amount: number) => amount <= 0 ? selectionStore.unselectProduct(id) : selectionStore.setQuantity(id, amount),
  updateCartonCount: (id: string, count: number) => {
    const line = selectionStore.getSnapshot().quotes.find(item => String(item.productId) === id)
    if (line) return selectionStore.setQuantity(id, count * line.sqmPerCarton)
  },
  removeItem: selectionStore.unselectProduct,
  clearCart: selectionStore.clearSelection,
  resetCart: selectionStore.clearSelection,
  setDemoMode: (_mode: CartDemoMode) => {},
}
export function useCart() {
  const state = useProductSelection()
  const productQuery = useCatalogIds(state.selectedIds)
  const allProducts = productQuery.data
  const items: CartItem[] = state.selectedIds.map(id => {
    const product = allProducts.find(item => item.id === id)
    const quote = state.quotes.find(item => String(item.productId) === id)
    const sqmPerCarton = quote?.sqmPerCarton ?? product?.sqmPerCarton ?? 1
    const requestedArea = state.quantities[id] ?? 0
    const cartonCount = quote?.cartonCount ?? Math.ceil(requestedArea / sqmPerCarton)
    const deliverableArea = quote?.deliverableArea ?? Math.round(cartonCount * sqmPerCarton * 100) / 100
    const unitPrice = quote?.unitPrice ?? product?.finalCustomerPricePerSqm ?? 0
    return { productType: quote?.productType ?? product?.productType ?? 'tile', unit: quote?.unit ?? (product?.productType === 'other' ? product.unit ?? 'piece' : 'm2'), productId: id, name: product?.name ?? `کالای ${id}`, slug: product?.slug ?? id, sku: product?.sku ?? id, dimension: product?.dimension ?? '', image: product?.images[0] ?? '',
      sqmPerCarton, areaPerCarton: sqmPerCarton, cartonsPerPallet: product?.cartonsPerPallet ?? null, requestedArea, cartonCount, deliverableArea, unitPrice,
      totalPrice: quote?.totalPrice ?? Math.round(deliverableArea * unitPrice), stockCartons: product?.stockCartons ?? 0, inventorySqm: product?.inventorySqm ?? 0 }
  })
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  return { ...cartStore, items, warehouse: state.warehouse, busy: state.busy, demoMode: 'normal' as CartDemoMode,
    itemCount: items.length, totalCartons: items.reduce((sum, item) => sum + item.cartonCount, 0),
    quantitySummary: summarizeQuantities(items.map(item => ({ unit: item.unit, quantity: item.deliverableArea }))),
    totalArea: Math.round(items.reduce((sum, item) => sum + item.deliverableArea, 0) * 100) / 100,
    subtotal, discountAmount: 0, taxAmount: 0, finalTotal: subtotal,
    hasBlockingIssues: state.busy || !state.warehouse || state.quotes.length !== items.length || productQuery.isPending || !!productQuery.error || allProducts.length !== state.selectedIds.length,
    isProductInCart: (id: string) => state.selectedIds.includes(id), getProductCartItem: (id: string) => items.find(item => item.productId === id),
  }
}
