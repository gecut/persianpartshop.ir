import { formatTrackingNumber } from '@/lib/utils/tracking-number'
import { TrackingNumber } from '@/components/ui/tracking-number'
import { DataStatus } from '@/components/feedback/data-status'
import { prepareReorderDraft } from '@/modules/products/selection-store'
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button, Modal } from '@heroui/react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ActivityFeedItem, OrderStatus } from '@persianpart/contract'
import type { Order, Product } from '@/types'
import { Badge } from '@/components/ui/badge'
import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDate, formatPersianDateTime } from '@/lib/utils/date'
import { formatUnit } from '@/lib/utils/unit'
import { toast } from '@/components/feedback/toast'
import { OrderCardSkeleton } from '@/components/ui/skeleton'
import {
  PackageIcon,
  BoxIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  ArrowLeftIcon,
  TomanIcon,
} from '@/components/ui/icons'
import { PreInvoiceModal } from '@/modules/checkout/pre-invoice-modal'
import { useCatalogIds } from '@/modules/products/catalog-data'
import { orderDetailOptions } from '@/modules/orders/order-store'
import { useAuth } from '@/modules/auth/auth-store'

export const Route = createFileRoute('/orders/')({
  validateSearch: (search: Record<string, unknown>): {
    filter?: 'all' | 'order' | 'supply'
    orderStatus?: OrderStatus
    view?: 'supply'
    requestId?: number
  } => ({
    filter:
      search.filter === 'order' || search.filter === 'supply'
        ? search.filter
        : search.view === 'supply'
          ? 'supply'
          : 'all',
    orderStatus:
      typeof search.orderStatus === 'string' &&
      ['pending', 'completed', 'cancel'].includes(search.orderStatus)
        ? (search.orderStatus as OrderStatus)
        : undefined,
    view: search.view === 'supply' ? 'supply' : undefined,
    requestId:
      /^[1-9]\d*$/.test(String(search.requestId ?? '')) &&
      Number.isSafeInteger(Number(search.requestId))
        ? Number(search.requestId)
        : undefined,
  }),
  component: UnifiedActivityFeedPage,
})



function getOrderStatusColor(status: string): 'primary' | 'warning' | 'success' | 'danger' {
  if (['completed', 'approve', 'approved'].includes(status)) return 'success'
  if (['cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'].includes(status)) return 'danger'
  if (status === 'pending') return 'warning'
  return 'primary'
}

function getSupplyStatusColor(status: string): 'primary' | 'warning' | 'success' | 'danger' | 'secondary' {
  if (status === 'supplied') return 'success'
  if (['unavailable', 'cancelled_by_customer'].includes(status)) return 'danger'
  if (status === 'reviewing') return 'warning'
  return 'primary'
}

// Order Polymorphic Card
const ActivityOrderCard = React.memo(function ActivityOrderCard({
  item,
  onReorder,
}: {
  item: Extract<ActivityFeedItem, { kind: 'order' }>
  onReorder: (orderId: string | number) => void
}) {
  const isCancelled = ['cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'].includes(item.status)

  return (
    <div className="p-4 space-y-3 rounded-2xl bg-muted/3 select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <TrackingNumber value={item.orderNumber || item.id} />
          <Badge variant={getOrderStatusColor(item.status)} size="sm">
            {item.statusLabel}
          </Badge>
        </div>

        <span className="text-xs text-muted font-medium">
          {formatPersianDate(item.createdAt)}
        </span>
      </div>

      {/* Thumbnails & summary */}
      <div className="space-y-2 min-w-0">
        {item.productImages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {item.productImages.map((img, idx) => (
              <img
                key={idx}
                src={img || '/assets/images/placeholder.svg'}
                alt=""
                className="size-13 border border-primary/20 rounded-2xl object-cover shrink-0 select-none"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.endsWith('/assets/images/placeholder.svg')) {
                    target.src = '/assets/images/placeholder.svg'
                  }
                }}
              />
            ))}
          </div>
        )}

        <div className="w-full flex items-center gap-2 font-bold rounded-lg py-3 px-4 bg-foreground text-background text-xs">
          <span>{toPersianDigits(item.itemCount)} قلم کالا</span>
          {item.quantitySummary && <span className="text-background/70">{item.quantitySummary}</span>}
        </div>

        {/* Financials & Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xs text-muted block font-medium leading-tight mb-0.5">
              مبلغ کل:
            </span>
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              <span>{formatToman(item.totalAmount)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isCancelled && item.canReorder && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onPress={() => onReorder(item.id)}
                className="h-10 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                aria-label="سفارش مجدد اقلام"
              >
                <RefreshCwIcon size={13} />
                <span>تکرار</span>
              </Button>
            )}

            <Link
              to="/orders/$id"
              params={{ id: String(item.id) }}
              className="h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
            >
              <span>پیگیری</span>
              <ArrowLeftIcon size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
})

// Supply Polymorphic Card
const ActivitySupplyCard = React.memo(function ActivitySupplyCard({
  item,
  onOpenDetail,
}: {
  item: Extract<ActivityFeedItem, { kind: 'supply' }>
  onOpenDetail: (id: number | string) => void
}) {
  const pallet =
    item.cartonsPerPallet && item.packageCount >= item.cartonsPerPallet
      ? Math.floor(item.packageCount / item.cartonsPerPallet)
      : 0
  const remainder =
    item.cartonsPerPallet && pallet > 0 ? item.packageCount % item.cartonsPerPallet : item.packageCount

  return (
    <div className="p-4 space-y-3 rounded-2xl bg-muted/3 select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <TrackingNumber value={item.requestNumber} />
          <Badge variant={getSupplyStatusColor(item.status)} size="sm">
            {item.statusLabel}
          </Badge>
        </div>

        <span className="text-xs text-muted font-medium">
          {formatPersianDate(item.createdAt)}
        </span>
      </div>

      {/* Product & quantity info */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center gap-3">
          <img
            src={item.productImage || '/assets/images/placeholder.svg'}
            alt={item.productName}
            className="size-13 border border-primary/20 rounded-2xl object-cover shrink-0 select-none"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget
              if (!target.src.endsWith('/assets/images/placeholder.svg')) {
                target.src = '/assets/images/placeholder.svg'
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-foreground truncate">{item.productName}</h4>
            <p className="text-xs text-muted mt-0.5">
              درخواستی: {toPersianDigits(item.requestedQuantity)} {formatUnit(item.unit)} (معادل{' '}
              {toPersianDigits(item.roundedQuantity)} {formatUnit(item.unit)})
            </p>
            <p className="text-[11px] text-muted">
              بسته‌بندی:{' '}
              {pallet > 0
                ? `${toPersianDigits(pallet)} پالت${remainder ? ` و ${toPersianDigits(remainder)} کارتن` : ''}`
                : `${toPersianDigits(item.packageCount)} بسته`}
            </p>
          </div>
        </div>

        {/* Due date status */}
        {['new', 'reviewing'].includes(item.status) && (
          <div className="text-xs">
            {item.isOverdue ? (
              <span className="text-danger font-semibold">مهلت بررسی گذشته است</span>
            ) : (
              <span className="text-muted">مهلت پاسخ: {formatPersianDateTime(item.responseDueAt)}</span>
            )}
          </div>
        )}

        {/* Financials & Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xs text-muted block font-medium leading-tight mb-0.5">
              مبلغ برآوردی:
            </span>
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              <span>{formatToman(item.estimatedTotal)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onPress={() => onOpenDetail(item.id)}
            className="h-10 px-4 rounded-2xl font-bold text-xs"
          >
            پیگیری
            <ArrowLeftIcon size={13} />
          </Button>
        </div>
      </div>
    </div>
  )
})

function UnifiedActivityFeedPage() {
  const { filter = 'all', orderStatus, requestId } = Route.useSearch()
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
