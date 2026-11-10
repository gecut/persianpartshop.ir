import { authStore } from '@/modules/auth/auth-store'
import { queryClient } from '@/lib/query-client'
import { queryKeys, mutationKeys } from '@/lib/query-keys'
import { catalogCoordinator } from '@/modules/products/catalog-data'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Order, type OrderItem, type TimelineStep } from './order-types'
import { api } from '@/lib/api-client'
import { formatGrade } from '@/modules/products/product-store'
import {
  formatPersianDate,
  formatPersianTimelineTs,
} from '@/lib/utils/date'
import { match, P } from 'ts-pattern'

export function buildFullOrderTimeline(
  doc: any,
  persianDate?: string,
  force60MinutesPassed?: boolean
): TimelineStep[] {
  const status: string = typeof doc.status === 'string' ? doc.status : 'pending'
  const cancelledBy: string | undefined = typeof doc.cancelledBy === 'string' ? doc.cancelledBy : undefined
  const pDate = persianDate || (doc.createdAt ? formatPersianDate(doc.createdAt) : '')

  const formatTs = (ts?: string) => {
    if (!ts) return undefined
    return formatPersianTimelineTs(ts, pDate)
  }

  const createdAtMs = doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now()
  const is60MinutesPassed = force60MinutesPassed ?? (Date.now() >= createdAtMs + 60 * 60 * 1000)

  // Cancellation Flow
  const cancelConfig = match([status, cancelledBy] as const)
    .with([P.union('cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'), P._], () => {
      const isCancelledByCustomer = status === 'cancelled_by_customer' || cancelledBy === 'customer'
      return {
        title: isCancelledByCustomer ? 'لغو توسط کاربر' : 'لغو توسط ادمین',
        desc: isCancelledByCustomer
          ? doc.notes || 'سفارش توسط کاربر لغو گردید.'
          : doc.notes || 'سفارش توسط واحد بازرگانی / ادمین لغو گردید.',
      }
    })
    .otherwise(() => null)

  if (cancelConfig) {
    const steps: TimelineStep[] = [
      {
        id: 'step-1',
        title: 'سفارش ثبت شده',
        description: 'سفارش با موفقیت در سامانه ثبت گردید.',
        timestamp: formatTs(doc.createdAt) || pDate,
        status: 'completed',
      },
    ]

    if (is60MinutesPassed) {
      steps.push({
        id: 'step-2',
        title: 'در حال بررسی واحد بازرگانی',
        description: 'سفارش در صف بررسی واحد بازرگانی قرار گرفته بود.',
        timestamp: formatTs(new Date(createdAtMs + 60 * 60 * 1000).toISOString()),
        status: 'completed',
      })
    }

    steps.push({
      id: 'step-cancel',
      title: cancelConfig.title,
      description: cancelConfig.desc,
      timestamp: formatTs(doc.updatedAt) || '',
      status: 'cancelled',
    })

    return steps
  }

  // Active / Normal Flow (3 stages)
  // Stage 1: سفارش ثبت شده
  // Stage 2: در حال بررسی واحد بازرگانی (تایید پس از ۶۰ دقیقه)
  // Stage 3: تکمیل شده (صدور حواله نهایی)
  const isApproved = match(status)
    .with(P.union('completed', 'approve', 'approved'), () => true)
    .otherwise(() => false)

  const step1Status: 'completed' = 'completed'
  const step2Status = match([isApproved, is60MinutesPassed] as const)
    .with([true, P._], () => 'completed' as const)
    .with([false, true], () => 'completed' as const)
    .with([false, false], () => 'current' as const)
    .exhaustive()

  const step3Status = match([isApproved, is60MinutesPassed] as const)
    .with([true, P._], () => 'completed' as const)
    .with([false, true], () => 'current' as const)
    .with([false, false], () => 'pending' as const)
    .exhaustive()

  const step1Timestamp = formatTs(doc.createdAt) || pDate
  const step2Timestamp = (isApproved || is60MinutesPassed)
    ? formatTs(new Date(createdAtMs + 60 * 60 * 1000).toISOString())
    : undefined
  const step3Timestamp = isApproved
    ? formatTs(doc.updatedAt || doc.createdAt) || pDate
    : undefined

  return [
    {
      id: 'step-1',
      title: 'سفارش ثبت شده',
      description: 'سفارش با موفقیت در سامانه ثبت گردید.',
      timestamp: step1Timestamp,
      status: step1Status,
    },
    {
      id: 'step-2',
      title: 'در حال بررسی واحد بازرگانی',
      description: (isApproved || is60MinutesPassed)
        ? 'سفارش در دست بررسی کارشناسان واحد بازرگانی قرار گرفت.'
        : 'سفارش جهت بررسی نهایی به واحد بازرگانی ارجاع داده خواهد شد.',
      timestamp: step2Timestamp,
      status: step2Status,
    },
    {
      id: 'step-3',
      title: 'تکمیل شده',
      description: isApproved
        ? 'حواله رسمی خروج از انبار صادر گردیده و سفارش با موفقیت تکمیل شد.'
        : 'در انتظار تایید نهایی و صدور حواله رسمی توسط واحد بازرگانی.',
      timestamp: step3Timestamp,
      status: step3Status,
    },
  ]
}

export function mapDocToOrder(doc: any): Order {
  const createdAt = doc.createdAt || new Date().toISOString()
  const persianDate = formatPersianDate(createdAt)
  const statusStr: string = typeof doc.status === 'string' ? doc.status : ''
  const normalizedStatus: string = statusStr === 'processing' ? 'pending' : (statusStr || 'pending')
  const cancelledByVal: string | undefined = typeof doc.cancelledBy === 'string' ? doc.cancelledBy : undefined

  const createdAtMs = new Date(createdAt).getTime()
  const is60MinutesPassed = Date.now() >= createdAtMs + 60 * 60 * 1000

  const statusLabel = match([normalizedStatus, is60MinutesPassed, cancelledByVal] as const)
    .with(['pending', true, P._], () => 'در حال بررسی واحد بازرگانی')
    .with(['pending', false, P._], () => 'سفارش ثبت شده')
    .with([P.union('completed', 'approve', 'approved'), P._, P._], () => 'تکمیل شده')
    .with(['cancelled_by_customer', P._, P._], () => 'لغو توسط کاربر')
    .with(['cancelled_by_admin', P._, P._], () => 'لغو توسط ادمین')
    .with([P.union('cancel', 'cancelled'), P._, 'customer'], () => 'لغو توسط کاربر')
    .with([P.union('cancel', 'cancelled'), P._, P._], () => 'لغو توسط ادمین')
    .otherwise(() => {
      console.warn(`[Order] Unknown order status received: ${normalizedStatus}`)
      return 'سفارش ثبت شده'
    })

  const cancelledBy: 'customer' | 'admin' | undefined = match([normalizedStatus, cancelledByVal] as const)
    .with(['cancelled_by_customer', P._], () => 'customer' as const)
    .with(['cancelled_by_admin', P._], () => 'admin' as const)
    .with([P.union('cancel', 'cancelled'), 'customer'], () => 'customer' as const)
    .with([P.union('cancel', 'cancelled'), 'admin'], () => 'admin' as const)
    .otherwise(() => undefined)

  const cdnUrl = import.meta.env.VITE_CDN_URL

  const items: OrderItem[] = (doc.items || []).map((i: any) => {
    const prod = typeof i.product === 'object' && i.product !== null ? i.product : null
    const width = prod?.width
    const height = prod?.height
    const dimension =
      width && height
        ? `${width}×${height}`
        : typeof prod?.dimension === 'string'
          ? prod.dimension
          : ''
    const grade = prod?.grade ? formatGrade(prod.grade) : ''
    const coverUrl = match(prod?.cover)
      .with({ url: P.select(P.string) }, (url) => url)
      .with({ filename: P.select(P.string) }, (fn) => (cdnUrl ? `${cdnUrl}/${encodeURIComponent(fn)}` : `/api/media/file/${fn}`))
      .with(P.string.regex(/^\//), (path) => path)
      .otherwise(() => '/assets/images/placeholder.svg')

    return {
      productId: String(prod?.id || i.product || ''),
      productName: i.productName || prod?.name || 'قطعه',
      productSlug: prod?.slug || '',
      productSku: i.productSku || prod?.sku || '',
      productImage: coverUrl,
      dimension,
      productType: i.productType ?? prod?.productType ?? 'tile',
      unit: i.unit ?? (prod?.productType === 'other' ? (prod?.unit ?? 'piece') : 'm2'),
      grade,
      requestedArea: i.requestedArea || 1,
      cartonCount: i.cartonCount || 1,
      cartonsPerPallet: i.cartonsPerPallet ?? null,
      deliverableArea: i.deliverableArea || 1,
      unitPrice: i.unitPrice || 0,
      totalPrice: i.totalPrice || 0,
    }
  })

  const timeline = buildFullOrderTimeline(doc, persianDate, is60MinutesPassed)

  const userObj = typeof doc.user === 'object' && doc.user !== null ? doc.user : null

  const orderNumber = String(doc.orderNumber || doc.id)

  return {
    id: String(doc.id),
    orderNumber,
    date: persianDate,
    createdAt,
    status: normalizedStatus as any,
    cancelledBy,
    statusLabel,
    storeName: userObj?.companyName || 'بازرگانی دهقان (پرشین پارت)',
    customerName: userObj?.fullName || 'خریدار محترم',
    customerPhone: userObj?.phone || '',
    warehouseName: doc.warehouseName ?? (typeof doc.warehouse === 'object' ? doc.warehouse?.name : undefined),
    deliveryAddress: doc.deliveryAddress || userObj?.address || 'انبار مرکزی بازرگانی دهقان',
    notes: doc.notes || '',
    cancellationDeadline: doc.cancellationDeadline || new Date(createdAtMs + 60 * 60 * 1000).toISOString(),
    items,
    subtotal: doc.subtotal || 0,
    discountAmount: doc.discountAmount || 0,
    taxAmount: doc.taxAmount || 0,
    finalTotal: doc.finalTotal || doc.subtotal || 0,
    timeline,
  }
}

export const orderDetailOptions = (id: string) => ({
  queryKey: queryKeys.orders.detail(id, authStore.getState().user?.id),
  queryFn: async ({ signal }: { signal: AbortSignal }) => mapDocToOrder(await api.order.getById({ id }, { signal })),
  staleTime: 30_000,
})
export const orderStore = {
  acceptOrder: (doc: unknown): Order => {
    const order = mapDocToOrder(doc)
    queryClient.setQueryData(queryKeys.orders.detail(order.id, authStore.getState().user?.id), order)
    return order
  },
}
export function useOrderDetail(id: string) {
  return useQuery(orderDetailOptions(id))
}
export function useCancelOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: mutationKeys.orders.cancel,
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) => api.order.cancel({ id: orderId, reason }),
    onSuccess: doc => {
      orderStore.acceptOrder(doc)
      void client.invalidateQueries({ queryKey: queryKeys.activityFeed.all })
      void client.invalidateQueries({ queryKey: queryKeys.orders.lists() })
      const order = mapDocToOrder(doc)
      void catalogCoordinator.ensureIds(order.items.map(item => item.productId), true).catch(() => {})
    },
  })
}
