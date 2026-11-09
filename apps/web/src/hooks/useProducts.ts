import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { mutationKeys } from '../lib/query-keys'
import { useCatalogProduct } from '../features/products/catalog-data'
export { useProducts, useProducts as useCatalog } from '../features/products/product-store'
export function useProductDetail(id: string | number | null) {
  const query = useCatalogProduct(id)
  return { product: query.data, isLoading: query.isPending, error: query.error?.message ?? null, refetch: query.refetch }
}
export const useProduct = useProductDetail
export function useCartonCalculation() {
  const mutation = useMutation({
    mutationKey: mutationKeys.products.calculateCartons,
    mutationFn: async ({ productId, requestedSqm }: { productId?: string; requestedSqm?: number }) => {
      return await api.catalog.calculateCartons({ productId, requestedSqm })
    },
  })

  return {
    calculate: mutation.mutateAsync,
    result: mutation.data,
    isCalculating: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  }
}
