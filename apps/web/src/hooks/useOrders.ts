import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Order, type OrderStatus } from '../lib/api-client'
import { queryKeys, mutationKeys } from '../lib/query-keys'

export function useCustomerOrders(status?: OrderStatus) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.list(status ? { status } : undefined),
    queryFn: async () => {
      const res = await api.order.list({ status })
      return res
    },
    staleTime: 30 * 1000,
  })

  return {
    orders: (data?.items || []) as Order[],
    total: data?.total || 0,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}

export function useOrderDetail(orderId: string | null) {
  const { data: order = null, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.detail(orderId || ''),
    queryFn: async () => {
      if (!orderId) return null
      return await api.order.getById({ id: orderId })
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,
  })

  return {
    order: order as Order | null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}

export function useOrderActions() {
  const queryClient = useQueryClient()

  const submitMutation = useMutation({
    mutationKey: mutationKeys.orders.submit,
    mutationFn: async ({
      items,
      notes,
    }: {
      items: Array<{ productId: string; requestedSqm: number }>
      notes?: string
    }) => {
      return await api.order.submit({ items, notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })

  const cancelMutation = useMutation({
    mutationKey: mutationKeys.orders.cancel,
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      return await api.order.cancel({ id: orderId, reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })

  const prepareReorderMutation = useMutation({
    mutationKey: mutationKeys.orders.prepareReorder,
    mutationFn: async (orderId: string) => {
      return await api.order.prepareReorder({ id: orderId })
    },
  })

  return {
    submitOrder: (items: Array<{ productId: string; requestedSqm: number }>, notes?: string) =>
      submitMutation.mutateAsync({ items, notes }),
    cancelOrder: (orderId: string, reason?: string) =>
      cancelMutation.mutateAsync({ orderId, reason }),
    prepareReorder: (orderId: string) => prepareReorderMutation.mutateAsync(orderId),
    isSubmitting: submitMutation.isPending,
    isCancelling: cancelMutation.isPending,
  }
}
