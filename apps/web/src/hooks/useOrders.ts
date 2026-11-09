import { useAuth } from '../features/auth/auth-store'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, type OrderStatus } from '../lib/api-client'
import { queryKeys, mutationKeys } from '../lib/query-keys'
import { useOrderDetail as useDetail, useCancelOrder } from '../features/orders/order-store'
import { useSubmitOrder } from '../features/orders/use-submit-order'
import { selectionStore } from '../features/products/selection-store'
export function useCustomerOrders(status?: OrderStatus) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: queryKeys.orders.list({ status, owner: user?.id }), queryFn: ({ signal }) => api.order.list({ status }, { signal }), staleTime: 30_000 })
  return { orders: query.data?.items ?? [], total: query.data?.total ?? 0, isLoading: query.isPending, error: query.error?.message ?? null, refetch: query.refetch }
}
export function useOrderDetail(id: string | null) {
  const query = useDetail(id ?? '')
  return { order: query.data ?? null, isLoading: query.isPending, error: query.error?.message ?? null, refetch: query.refetch }
}
export function useOrderActions() {
  const submit = useSubmitOrder(), cancel = useCancelOrder()
  const reorder = useMutation({ mutationKey: mutationKeys.orders.prepareReorder, mutationFn: (id: string) => api.order.prepareReorder({ id }) })
  return {
    submitOrder: (items: Array<{ productId: string; requestedSqm: number }>, notes?: string) => submit.mutateAsync({ warehouseId: selectionStore.getSnapshot().warehouse?.id ?? 0, items: items.map(item => ({ productId: item.productId, requestedArea: item.requestedSqm })), notes, idempotencyKey: selectionStore.submissionKey(notes) }),
    cancelOrder: (orderId: string, reason?: string) => cancel.mutateAsync({ orderId, reason }),
    prepareReorder: (id: string) => reorder.mutateAsync(id), isSubmitting: submit.isPending, isCancelling: cancel.isPending,
  }
}
