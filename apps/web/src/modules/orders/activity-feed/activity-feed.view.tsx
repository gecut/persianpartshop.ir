import { updateSavedOfflineRecord } from '@/modules/pwa/offline-package'
import { offlineRecoveryEnabled } from '@/modules/pwa/read-source'
import { QueryLoadError } from '@/components/feedback/query-load-error'
import { prepareReorderDraft } from '@/modules/products/selection-store'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OrderStatus } from '@persianpart/contract'
import type { Order } from '@/modules/orders/order-types'
import { toast } from '@/components/feedback/toast'
import { OrderCardSkeleton } from '@/modules/orders/order-card-skeleton'
import { PackageIcon, RefreshCwIcon } from '@/components/ui/icons'
import { PreInvoiceModal } from '@/modules/checkout/pre-invoice-modal'
import { useCatalogIds } from '@/modules/products/catalog-data'
import { orderDetailOptions } from '@/modules/orders/order-store'
import { useAuth } from '@/modules/auth/auth-store'
import { useNetworkReadSource } from '@/modules/pwa/read-source'
import { useOnline } from '@/lib/use-online'
import { useSavedOfflinePackage } from '@/modules/pwa/offline-package'
import { ActivityOrderCard } from './_activity-order-card'
import { ActivitySupplyCard } from './_activity-supply-card'
import { ActivityTypeTabs } from './_activity-type-tabs'
import { ActivityStatusTabs } from './_activity-status-tabs'
import { ActivityEmptyState } from './_activity-empty-state'
import { SupplyDetailModal } from './_supply-detail-modal'
import { buildReorderDraft } from './_build-reorder-draft'

const routeApi = getRouteApi('/orders/')

export function ActivityFeedView() {
  const { filter = 'all', orderStatus, requestId } = routeApi.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const online = useOnline()
  const networkRead = useNetworkReadSource()
  const { active, restoring } = useSavedOfflinePackage()
  const [reorderOrder, setReorderOrder] = useState<Order | null>(null)
  const { data: allProducts } = useCatalogIds(reorderOrder?.items.map(item => item.productId) ?? [])
  const [activeSupplyId, setActiveSupplyId] = useState<number | null>(requestId ?? null)

  useEffect(() => {
    if (requestId) setActiveSupplyId(requestId)
  }, [requestId])

  // Infinite query for activity feed
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isPending,
    error,
    isFetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.activityFeed.list(filter, orderStatus, user?.id),
    queryFn: ({ pageParam, signal }) =>
      api.activityFeed.list({
        filter,
        orderStatus,
        cursor: pageParam ?? undefined,
        limit: 20,
      }, { signal }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnReconnect: 'always',
    enabled: Boolean(user) && networkRead,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
  })

  // Flatten items
  const items = useMemo(() => {
    if (networkRead) return data?.pages.flatMap(page => page.items) ?? []
    return active?.data.activity.filter(item =>
      (filter === 'all' || item.kind === filter) && (!orderStatus || (item.kind === 'order' && item.status === orderStatus))
    ).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.id) - Number(a.id) || a.kind.localeCompare(b.kind)) ?? []
  }, [data, networkRead, active, filter, orderStatus])

  // Infinite scroll observer
  const observerTargetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!networkRead || !hasNextPage || isFetching || isFetchNextPageError) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage({ cancelRefetch: false })
        }
      },
      { rootMargin: '300px', threshold: 0.1 },
    )

    const el = observerTargetRef.current
    if (el) observer.observe(el)
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [networkRead, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage])

  // Supply detail query & cancel mutation
  const supplyDetail = useQuery({
    queryKey: queryKeys.supplyRequests.detail(user ? String(user.id) : '', activeSupplyId ?? 0),
    queryFn: () => api.supplyRequest.detail({ id: activeSupplyId! }),
    enabled: Boolean(user && activeSupplyId) && networkRead,
  })
  const savedSupply = activeSupplyId ? active?.data.supplies[activeSupplyId] : undefined

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.supplyRequest.cancel({ id }),
    onSuccess: result => {
      if (offlineRecoveryEnabled) void updateSavedOfflineRecord({ kind: 'supply', id: String(result.id) }).catch(() => {})
      queryClient.setQueryData(queryKeys.supplyRequests.detail(user?.id ?? '', result.id), result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.supplyRequests.lists(user?.id ?? '') })
      toast.success('درخواست تأمین با موفقیت لغو شد.')

    },
    onError: () => {
      toast.error('لغو درخواست ممکن نشد؛ وضعیت تازه را بررسی کنید.')
    },
  })

  const handleCloseSupplyModal = () => {
    setActiveSupplyId(null)
    if (requestId) {
      void navigate({
        to: '/orders',
        search: (prev) => ({ ...prev, requestId: undefined, view: undefined }),
        replace: true,
      })
    }
  }

  // Reorder handling
  const handleReorder = useCallback(
    async (orderId: string | number) => {
      try {
        const doc = await queryClient.fetchQuery(orderDetailOptions(String(orderId)))
        if (doc) {
          const mapped = doc
          if (await prepareReorderDraft(mapped.items)) {
            setReorderOrder(mapped)
          }
        }
      } catch {
        toast.error('دریافت اطلاعات سفارش برای تکرار ممکن نشد.')
      }
    },
    [],
  )

  const { reorderProducts, reorderQuantities } = useMemo(
    () => buildReorderDraft(reorderOrder?.items, allProducts),
    [reorderOrder?.items, allProducts],
  )


  const setFilterTab = (tab: 'all' | 'order' | 'supply') => {
    void navigate({
      to: '/orders',
      search: (prev) => ({
        ...prev,
        filter: tab,
        orderStatus: tab === 'order' ? prev.orderStatus : undefined,
        view: undefined,
      }),
    })
  }

  const setOrderStatusFilter = (status?: OrderStatus) => {
    void navigate({
      to: '/orders',
      search: (prev) => ({
        ...prev,
        filter: 'order',
        orderStatus: status,
      }),
    })
  }

  return (
    <div className="w-full h-full px-3 py-3 space-y-3 select-none text-start">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5">
          <PackageIcon size={20} className="text-primary" />
          <span>درخواست‌ها و سفارش‌ها</span>
        </h1>
        <p className="text-xs text-muted mt-1">پیگیری سفارش‌ها و درخواست‌های تأمین</p>
      </div>

      <ActivityTypeTabs filter={filter} onSelect={setFilterTab} />

      {filter === 'order' && (
        <ActivityStatusTabs orderStatus={orderStatus} onSelect={setOrderStatusFilter} />
      )}
      {(networkRead ? isPending : restoring) ? (
        <div className="space-y-2.5">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ) : !networkRead && !active ? (
        <p role="status">برای دریافت سوابق به اینترنت وصل شوید.</p>
      ) : networkRead && error && !data ? (
        <QueryLoadError message="دریافت فهرست سفارش‌ها ممکن نشد." onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <ActivityEmptyState filter={filter} />
      ) : (
        <div className="space-y-3">
          {items.map((item) =>
            item.kind === 'order' ? (
              <ActivityOrderCard key={`order-${item.id}`} item={online ? item : { ...item, canReorder: false }} onReorder={handleReorder} />
            ) : (
              <ActivitySupplyCard
                key={`supply-${item.id}`}
                item={item}
                onOpenDetail={(id) => setActiveSupplyId(Number(id))}
              />
            ),
          )}

          {/* Infinite Scroll Sentinel */}
          {networkRead && hasNextPage && (
            <div
              ref={observerTargetRef}
              className="py-6 flex flex-col items-center justify-center gap-2 text-muted"
            >
              <RefreshCwIcon className="w-5 h-5 animate-spin text-primary" />
              <span className="text-xs font-medium">در حال بارگذاری موارد بیشتر...</span>
            </div>
          )}
        </div>
      )}

      <SupplyDetailModal
        isOpen={Boolean(activeSupplyId) && (!offlineRecoveryEnabled || online || !networkRead)}
        onClose={handleCloseSupplyModal}
        supplyDetail={networkRead ? supplyDetail : { data: savedSupply, isPending: !!restoring, error: !restoring && !savedSupply ? new Error('Offline request unavailable') : null }}
        online={online}
        isCancelling={cancelMutation.isPending}
        onCancel={(id) => cancelMutation.mutate(id)}
      />

      {/* PreInvoiceModal for reordering */}
      <PreInvoiceModal
        isOpen={Boolean(reorderOrder)}
        onClose={() => setReorderOrder(null)}
        products={reorderProducts}
        quantities={reorderQuantities}
        onSuccess={(newOrderId) => {
          setReorderOrder(null)
          toast.success('سفارش مجدد شما با موفقیت ثبت شد.')
          void navigate({
            to: '/orders/$id',
            params: { id: String(newOrderId) },
          })
        }}
      />
    </div>
  )
}
