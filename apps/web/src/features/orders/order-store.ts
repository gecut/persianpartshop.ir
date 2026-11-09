import { authStore } from '../auth/auth-store'
import { queryClient } from '../../lib/query-client'
import { queryKeys, mutationKeys } from '../../lib/query-keys'
import { catalogCoordinator } from '../products/catalog-data'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Order, type OrderItem, type TimelineStep } from '../../types'
import { api } from '../../lib/api-client'
import { formatGrade } from '../products/product-store'
import {
  formatPersianDate,
  formatPersianTimelineTs,
} from '../../lib/utils/date'

export function buildFullOrderTimeline(
  doc: any,
  persianDate?: string,
  force60MinutesPassed?: boolean
): TimelineStep[] {
  const status = doc.status || 'pending'
  const isCancelled =
    status === 'cancel' ||
    status === 'cancelled' ||
    status === 'cancelled_by_customer' ||
    status === 'cancelled_by_admin'
  const isCancelledByCustomer =
    isCancelled &&
    (status === 'cancelled_by_customer' || doc.cancelledBy === 'customer')

  const pDate = persianDate || (doc.createdAt ? formatPersianDate(doc.createdAt) : '')

  const formatTs = (ts?: string) => {
    if (!ts) return undefined
    return formatPersianTimelineTs(ts, pDate)
  }

  const createdAtMs = doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now()
  const is60MinutesPassed = force60MinutesPassed ?? (Date.now() >= createdAtMs + 60 * 60 * 1000)
  const isApproved = status === 'completed' || status === 'approve' || status === 'approved'

  // Cancellation Flow
  if (isCancelled) {
    const cancelTitle = isCancelledByCustomer ? 'لغو توسط کاربر' : 'لغو توسط ادمین'

    const cancelDesc = isCancelledByCustomer
      ? doc.notes || 'سفارش توسط کاربر لغو گردید.'
      : doc.notes || 'سفارش توسط واحد بازرگانی / ادمین لغو گردید.'

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
      title: cancelTitle,
      description: cancelDesc,
      timestamp: formatTs(doc.updatedAt) || '',
      status: 'cancelled',
    })

    return steps
  }

  // Active / Normal Flow (3 stages)
  // Stage 1: سفارش ثبت شده
  // Stage 2: در حال بررسی واحد بازرگانی (تایید پس از ۶۰ دقیقه)
  // Stage 3: تکمیل شده (صدور حواله نهایی)
  const step1Status: 'completed' = 'completed'
  const step2Status: 'completed' | 'current' = (isApproved || is60MinutesPassed) ? 'completed' : 'current'
  const step3Status: 'completed' | 'current' | 'pending' = isApproved ? 'completed' : is60MinutesPassed ? 'current' : 'pending'

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
  const normalizedStatus = doc.status === 'processing' ? 'pending' : (doc.status || 'pending')

  const createdAtMs = new Date(createdAt).getTime()
  const is60MinutesPassed = Date.now() >= createdAtMs + 60 * 60 * 1000

  let statusLabel = 'سفارش ثبت شده'
  if (normalizedStatus === 'pending') {
    statusLabel = is60MinutesPassed ? 'در حال بررسی واحد بازرگانی' : 'سفارش ثبت شده'
  } else if (normalizedStatus === 'completed' || normalizedStatus === 'approve' || normalizedStatus === 'approved') {
    statusLabel = 'تکمیل شده'
  } else if (normalizedStatus === 'cancelled_by_customer') {
    statusLabel = 'لغو توسط کاربر'
  } else if (normalizedStatus === 'cancelled_by_admin') {
    statusLabel = 'لغو توسط ادمین'
  } else if (normalizedStatus === 'cancel' || normalizedStatus === 'cancelled') {
    statusLabel = doc.cancelledBy === 'customer' ? 'لغو توسط کاربر' : 'لغو توسط ادمین'
  }

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
    const cdnUrl = import.meta.env.VITE_CDN_URL
    const coverUrl =
      prod?.cover?.url ||
      (prod?.cover?.filename && cdnUrl ? `${cdnUrl}/${encodeURIComponent(prod.cover.filename)}` : '') ||
      (prod?.cover?.filename ? `/api/media/file/${prod.cover.filename}` : '') ||
      (typeof prod?.cover === 'string' && prod.cover.startsWith('/') ? prod.cover : '') ||
      '/assets/images/placeholder.svg'
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

  const orderNumber = String(doc.orderNumber || doc.id);

  return {
    id: String(doc.id),
    orderNumber,
    date: persianDate,
    createdAt,
    status: normalizedStatus as any,
    cancelledBy: doc.cancelledBy || (normalizedStatus === 'cancelled_by_customer' ? 'customer' : normalizedStatus === 'cancelled_by_admin' ? 'admin' : undefined),
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
