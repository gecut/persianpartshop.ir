import { useQuery, useMutation } from '@tanstack/react-query'
import { api, type CatalogProduct } from '../lib/api-client'
import { queryKeys, mutationKeys } from '../lib/query-keys'

export function useProducts(filters?: {
  categoryId?: string | number
  brandId?: string | number
  search?: string
  color?: string
  grade?: string
  onlyActive?: boolean
  page?: number
  limit?: number
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: async () => {
      return await api.catalog.list(filters || {})
    },
    staleTime: 60 * 1000,
  })

  return {
    products: (data?.items || []) as CatalogProduct[],
    total: data?.total || 0,
    page: data?.page || 1,
    limit: data?.limit || 50,
    totalPages: data?.totalPages || 1,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}

export function useProductDetail(productId: string | number | null) {
  const { data: product = null, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.products.detail(productId || ''),
    queryFn: async () => {
      if (!productId) return null
      return await api.catalog.getById({ id: isNaN(Number(productId)) ? productId : Number(productId) })
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    product: product as CatalogProduct | null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}

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

// Aliases for compatibility
export const useCatalog = useProducts
export const useProduct = useProductDetail
