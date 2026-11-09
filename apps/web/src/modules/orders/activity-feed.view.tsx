import { formatTrackingNumber } from '@/lib/utils/tracking-number'
import { DataStatus } from '@/components/feedback/data-status'
import { prepareReorderDraft } from '@/modules/products/selection-store'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { Button, Modal } from '@heroui/react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OrderStatus } from '@persianpart/contract'
import type { Order } from './order-types'
import type { Product } from '@/modules/products/product-types'
import { Badge } from '@/components/ui/badge'
import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDateTime } from '@/lib/utils/date'
import { formatUnit } from '@/lib/utils/unit'
import { toast } from '@/components/feedback/toast'
import { OrderCardSkeleton } from './order-card-skeleton'
import { PackageIcon, BoxIcon, ClockIcon, CheckCircle2Icon, AlertCircleIcon, RefreshCwIcon } from '@/components/ui/icons'
import { PreInvoiceModal } from '@/modules/checkout/pre-invoice-modal'
import { useCatalogIds } from '@/modules/products/catalog-data'
import { orderDetailOptions } from './order-store'
import { useAuth } from '@/modules/auth/auth-store'
import { ActivityOrderCard } from './_activity-order-card'
import { ActivitySupplyCard, getSupplyStatusColor } from './_activity-supply-card'

const routeApi = getRouteApi('/orders/')

export function ActivityFeedView() {
  const { filter = 'all', orderStatus, requestId } = routeApi.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
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
    isFetchingNextPage,
    isLoading,
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
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
  })

  // Flatten items
  const items = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  // Infinite scroll observer
  const observerTargetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage()
        }
      },
      { rootMargin: '300px', threshold: 0.1 },
    )

    const el = observerTargetRef.current
    if (el) observer.observe(el)
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Supply detail query & cancel mutation
  const supplyDetail = useQuery({
    queryKey: queryKeys.supplyRequests.detail(user ? String(user.id) : '', activeSupplyId ?? 0),
    queryFn: () => api.supplyRequest.detail({ id: activeSupplyId! }),
    enabled: Boolean(user && activeSupplyId),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.supplyRequest.cancel({ id }),
    onSuccess: result => {
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

  const { reorderProducts, reorderQuantities } = useMemo(() => {
    if (!reorderOrder?.items) return { reorderProducts: [], reorderQuantities: {} }
    const products: Product[] = reorderOrder.items.map((item) => {
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
    reorderOrder.items.forEach((item) => {
      quantities[item.productId] = item.requestedArea || item.deliverableArea
    })
    return { reorderProducts: products, reorderQuantities: quantities }
  }, [reorderOrder?.items, allProducts])

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

      <div className="flex items-center gap-1.5 w-full" role="group" aria-label="نوع سوابق">
        {([
          { key: 'all', label: 'همه', icon: PackageIcon },
          { key: 'order', label: 'سفارش‌ها', icon: BoxIcon },
          { key: 'supply', label: 'درخواست‌های تأمین', icon: ClockIcon },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="ghost"
            aria-pressed={filter === key}
            onPress={() => setFilterTab(key)}
            className={`h-18 flex-1 min-w-0 p-1.5 flex flex-col gap-1 rounded-2xl text-xs ${filter === key ? 'bg-[#252745] text-background' : 'bg-muted/5 text-muted'}`}
          >
            <Icon size={24} aria-hidden />
            <span>{label}</span>
          </Button>
        ))}
      </div>

      {filter === 'order' && (
        <div className="flex items-center gap-1.5 w-full" role="group" aria-label="وضعیت سفارش">
          {([
            { key: undefined, label: 'همه سفارش‌ها', icon: PackageIcon },
            { key: 'pending', label: 'در حال بررسی', icon: ClockIcon },
            { key: 'completed', label: 'تکمیل شده', icon: CheckCircle2Icon },
            { key: 'cancel', label: 'لغو شده', icon: AlertCircleIcon },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button key={key ?? 'all'} variant="ghost"
              aria-pressed={orderStatus === key} onPress={() => setOrderStatusFilter(key)}
              className={`h-18 flex-1 min-w-0 p-1.5 flex flex-col gap-1 rounded-2xl text-[10.5px] sm:text-xs ${orderStatus === key ? 'bg-[#252745] text-background' : 'bg-muted/5 text-muted'}`}>
              <Icon size={24} aria-hidden /><span>{label}</span>
            </Button>
          ))}
        </div>
      )}

      {error && <DataStatus
          error={error}
          hasData={items.length > 0}
          fetching={isFetching}
          onRetry={() => void refetch()}
        />}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-2.5">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-muted/5 rounded-2xl p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
            <PackageIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-foreground">موردی یافت نشد</h3>
          <p className="text-xs text-muted">
            {filter === 'order'
              ? 'هنوز سفارشی ثبت نشده است.'
              : filter === 'supply'
                ? 'هنوز درخواست تأمینی ثبت نشده است.'
                : 'هنوز فعالیتی ثبت نشده است.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) =>
            item.kind === 'order' ? (
              <ActivityOrderCard key={`order-${item.id}`} item={item} onReorder={handleReorder} />
            ) : (
              <ActivitySupplyCard
                key={`supply-${item.id}`}
                item={item}
                onOpenDetail={(id) => setActiveSupplyId(Number(id))}
              />
            ),
          )}

          {/* Infinite Scroll Sentinel */}
          {hasNextPage && (
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

      {/* Supply Request Detail Modal */}
      <Modal.Root isOpen={Boolean(activeSupplyId)} onOpenChange={(open) => { if (!open) handleCloseSupplyModal() }}>
        <Modal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
        >
          <Modal.Container className="w-full max-w-xl">
            <Modal.Dialog className="bg-surface rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto text-start">
              <Modal.Header className="p-4 border-b border-border flex items-center justify-between">
                <Modal.Heading className="font-bold text-base text-foreground">
                  جزئیات درخواست تأمین
                </Modal.Heading>
                <Modal.CloseTrigger aria-label="بستن" />
              </Modal.Header>

              <Modal.Body className="space-y-4 p-4 pb-safe text-sm">
                {supplyDetail.isPending && <p>در حال دریافت اطلاعات درخواست…</p>}
                {supplyDetail.error && (
                  <p role="alert" className="text-danger">
                    دریافت اطلاعات درخواست با خطا مواجه شد.
                  </p>
                )}

                {supplyDetail.data && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-border">
                      <span className="text-muted">شماره پیگیری:</span>
                      <span className="font-bold text-foreground tabular-nums" dir="ltr">
                        {formatTrackingNumber(supplyDetail.data.requestNumber)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted">نام محصول:</span>
                      <span className="font-bold text-foreground">{supplyDetail.data.productName}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted">وضعیت:</span>
                      <Badge variant={getSupplyStatusColor(supplyDetail.data.status)}>
                        {supplyDetail.data.status === 'new'
                          ? 'ثبت‌شده'
                          : supplyDetail.data.status === 'reviewing'
                            ? 'در حال بررسی'
                            : supplyDetail.data.status === 'supplied'
                              ? 'تأمین شده'
                              : supplyDetail.data.status === 'unavailable'
                                ? 'غیرقابل تأمین'
                                : 'لغو شده'}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted">مقدار درخواستی:</span>
                      <span className="font-bold text-foreground">
                        {toPersianDigits(supplyDetail.data.requestedQuantity)}{' '}
                        {formatUnit(supplyDetail.data.unit)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted">معادل بسته کامل:</span>
                      <span className="font-bold text-foreground">
                        {toPersianDigits(supplyDetail.data.roundedQuantity)}{' '}
                        {formatUnit(supplyDetail.data.unit)}
                      </span>
                    </div>



                    <div className="flex justify-between items-center">
                      <span className="text-muted">مبلغ برآوردی:</span>
                      <span className="font-bold text-primary">
                        {formatToman(supplyDetail.data.estimatedTotal)} تومان
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted">زمان ثبت:</span>
                      <span className="text-foreground">
                        {formatPersianDateTime(supplyDetail.data.createdAt)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted">مهلت پاسخ:</span>
                      <span className="text-foreground">
                        {formatPersianDateTime(supplyDetail.data.responseDueAt)}
                      </span>
                    </div>

                    {supplyDetail.data.notes && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-muted block text-xs mb-1">یادداشت شما:</span>
                        <p className="p-2.5 rounded-xl bg-muted/10 text-xs text-foreground whitespace-pre-wrap">
                          {supplyDetail.data.notes}
                        </p>
                      </div>
                    )}

                    {supplyDetail.data.canCancel && (
                      <div className="pt-2">
                        <Button
                          fullWidth
                          variant="danger-soft"
                          isPending={cancelMutation.isPending}
                          onPress={() => {
                            if (window.confirm('آیا از لغو این درخواست تأمین اطمینان دارید؟')) {
                              cancelMutation.mutate(supplyDetail.data!.id)
                            }
                          }}
                        >
                          لغو درخواست تأمین
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

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
