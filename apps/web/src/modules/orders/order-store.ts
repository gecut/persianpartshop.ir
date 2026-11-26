import type { CustomerOrderDocument } from '@persianpart/contract'
import { updateSavedOfflineRecord } from '@/modules/pwa/offline-package'
import { offlineRecoveryEnabled } from '@/modules/pwa/read-source'
import { authStore } from '@/modules/auth/auth-store'
import { queryClient } from '@/lib/query-client'
import { queryKeys, mutationKeys } from '@/lib/query-keys'
import { catalogCoordinator } from '@/modules/catalog/catalog-data'
import { useSavedOfflinePackage } from '@/modules/pwa/offline-package'
import { useNetworkReadSource } from '@/modules/pwa/read-source'
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Order } from './order-types'
import { api } from '@/lib/api-client'
import { buildFullOrderTimeline, mapDocToOrder } from './order-mapper'

export { buildFullOrderTimeline }

export const orderDetailOptions = (id: string) => ({
  queryKey: queryKeys.orders.detail(id, authStore.getState().user?.id),
  queryFn: async ({ signal }: { signal: AbortSignal }) => mapDocToOrder(await api.order.getById({ id }, { signal })),
  staleTime: 30_000,
  refetchInterval: 30_000,
  refetchOnReconnect: 'always' as const,
})
export const orderStore = {
  acceptOrder: (doc: CustomerOrderDocument): Order => {
    const order = mapDocToOrder(doc)
    queryClient.setQueryData(queryKeys.orders.detail(order.id, authStore.getState().user?.id), order)
    return order
  },
}
export function useOrderDetail(id: string) {
  const online = useNetworkReadSource()
  const { active, restoring } = useSavedOfflinePackage()
  const query = useQuery({ ...orderDetailOptions(id), enabled: online })
  const saved = active?.data.orders[id]
  const data = useMemo(() => saved ? mapDocToOrder(saved) : undefined, [saved])
  return online ? { ...query, savedAt: undefined } : {
    ...query, data, savedAt: active?.manifest?.capturedAt ?? active?.completedAt, isPending: !!restoring,
    error: !restoring && !data ? new Error('برای دریافت این سفارش به اینترنت وصل شوید.') : null,
  }
}
export function useCancelOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: mutationKeys.orders.cancel,
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) => api.order.cancel({ id: orderId, reason }),
    onSuccess: async (doc, { orderId }) => {
      const detailKey = queryKeys.orders.detail(orderId, authStore.getState().user?.id)
      await client.cancelQueries({ queryKey: detailKey, exact: true })
      orderStore.acceptOrder(doc)
      if (offlineRecoveryEnabled) void updateSavedOfflineRecord({ kind: 'order', id: orderId }).catch(() => {})
      void client.invalidateQueries({ queryKey: queryKeys.activityFeed.all })
      void client.invalidateQueries({ queryKey: queryKeys.orders.lists() })
      const order = mapDocToOrder(doc)
      void catalogCoordinator.ensureIds(order.items.map(item => item.productId), true).catch(() => {})
    },
  })
}
