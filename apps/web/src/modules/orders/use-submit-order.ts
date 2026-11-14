import { updateSavedOfflineRecord } from '@/modules/pwa/offline-package'
import { offlineRecoveryEnabled } from '@/modules/pwa/read-source'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { mutationKeys, queryKeys } from '@/lib/query-keys'
import { catalogCoordinator } from '@/modules/products/catalog-data'
import { orderStore } from './order-store'

export function useSubmitOrder() {
  return useMutation({
    mutationKey: mutationKeys.orders.submit,
    mutationFn: (input: Parameters<typeof api.order.submit>[0]) => api.order.submit(input),
    onSuccess: (order, input) => {
      orderStore.acceptOrder(order)
      if (offlineRecoveryEnabled) void updateSavedOfflineRecord({ kind: 'order', id: String(order.id) }).catch(() => {})
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all })
      void catalogCoordinator.ensureIds(input.items.map(item => String(item.productId)), true).catch(() => {})
    },
  })
}
