import { authStore } from '../auth/auth-store'
import { selectionStore, prepareReorderDraft } from '../products/selection-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Order, type OrderItem, type TimelineStep } from '../../types'
import { api } from '../../lib/api-client'
import { formatGrade } from '../products/product-store'
import {
  formatPersianDate,
  formatPersianTimelineTs,
} from '../../lib/utils/date'

const STORAGE_KEY = 'persianpart_orders_v2'

function getInitialState(): Order[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    // Purge legacy fake mock orders storage
    localStorage.removeItem('persianpart_orders')

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        // Discard any fake IDs
        const filtered = parsed.filter(
          (o) => !['ord-101', 'ord-102', 'ord-103', 'ord-104'].includes(o.id) && !o.id.startsWith('ord-fake')
        )
          return filtered.map((o) => {
            if (o.status === 'pending' || o.status === 'completed' || o.status === 'approve' || o.status === 'approved') {
              delete o.cancelledBy
            }
            if (o.date && (o.date.includes('2026') || o.date.includes('2025') || o.date.includes('2024') || o.date.startsWith('20'))) {
              return {
                ...o,
                date: formatPersianDate(o.createdAt || o.date),
              }
            }
            return o
          })
      }
    }
  } catch {
    // fallback
  }
  return []
}

let currentOrders: Order[] = getInitialState()
let ordersOwner = ''
const accountId = () => authStore.getState().user?.id ?? ''
function ensureOwner() {
  const nextOwner = accountId()
  if (ordersOwner !== nextOwner) {
    ordersOwner = nextOwner
    currentOrders = []
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* Storage may be unavailable. */ }
  }
}
const listeners = new Set<(orders: Order[]) => void>()

function broadcast(orders: Order[]) {
  currentOrders = orders
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
    } catch {
      // ignore
    }
  }
  listeners.forEach((listener) => listener(currentOrders))
}

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

  const cleanId = String(doc.id).replace(/^ord-/, "").replace(/^ptp\s*/i, "");
  const orderNumber = doc.orderNumber && /^ptp\s+/i.test(doc.orderNumber)
    ? doc.orderNumber.toLowerCase()
    : `ptp ${cleanId}`;

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

export const orderStore = {
  getOrders: () => ordersOwner === accountId() ? currentOrders : [],
  getOrderById: (id: string) => ordersOwner === accountId() ? currentOrders.find(o => o.id === id || o.orderNumber === id) : undefined,

  fetchOrderById: async (id: string): Promise<Order | null> => {
    ensureOwner()
    const expectedOwner = accountId()
    try {
      const doc: any = await api.order.getById({ id })
      if (expectedOwner !== accountId()) return null
      if (doc && doc.id) {
        const order = mapDocToOrder(doc)
        const updated = [order, ...currentOrders.filter((o) => o.id !== order.id)]
        broadcast(updated)
        return order
      }
    } catch (err) {
      throw err
    }
    return null
  },

  syncFromApi: async () => {
    ensureOwner()
    const expectedOwner = accountId()
    try {
      const res = await api.order.list()
      if (expectedOwner !== accountId()) return
      broadcast((res.items ?? []).map(mapDocToOrder))
    } catch {
      // Keep existing orders if API fails
    }
  },

  acceptOrder: (doc: unknown): Order => {
    ensureOwner()
    const order = mapDocToOrder(doc)
    broadcast([order, ...currentOrders.filter(item => item.id !== order.id)])
    return order
  },
  createOrder: async (payload: { items: OrderItem[]; notes?: string; deliveryAddress?: string; [key: string]: unknown }): Promise<Order> => {
    const draft = selectionStore.getSnapshot()
    if (!draft.warehouse || draft.busy) throw new Error('ابتدا انبار سبد را انتخاب کنید.')
    const submittedDraft = selectionStore.submissionSnapshot()
    const doc = await api.order.submit({ warehouseId: draft.warehouse.id, items: payload.items.map(item => ({ productId: item.productId, requestedArea: item.requestedArea })), notes: payload.notes, deliveryAddress: payload.deliveryAddress, idempotencyKey: selectionStore.submissionKey(JSON.stringify([payload.notes ?? '', payload.deliveryAddress ?? null])) })
    if (!selectionStore.finishSubmission(submittedDraft)) throw new Error('حساب کاربری تغییر کرده است.')
    const order = orderStore.acceptOrder(doc)
    return order
  },

  clearOrders: () => {
    currentOrders = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    listeners.forEach((listener) => listener([]))
  },

  updateOrder: (
    orderId: string,
    payload: {
      items: OrderItem[]
      subtotal: number
      discountAmount: number
      taxAmount: number
      finalTotal: number
      notes?: string
    }
  ): Order | null => {
    void orderId; void payload
    throw new Error('برای تغییر اقلام، سفارش را لغو و دوباره ثبت کنید.')
  },

  cancelOrder: async (orderId: string, reason?: string): Promise<boolean> => {
    const expectedOwner = accountId()
    const numericId = !isNaN(Number(orderId)) ? Number(orderId) : orderId
    const doc = await api.order.cancel({ id: numericId, reason })
    if (expectedOwner !== accountId()) throw new Error('حساب کاربری تغییر کرده است.')
    orderStore.acceptOrder(doc)
    return true
  },

  reorderToCart: async (orderId: string) => {
    const order = currentOrders.find(item => item.id === orderId)
    if (!order) return { success: false, warnings: ['سفارش یافت نشد.'] }
    const success = await prepareReorderDraft(order.items)
    return { success, warnings: success ? [] : ['ابتدا سبد و موجودی را بررسی کنید.'] }
  },
}

import { queryKeys, mutationKeys } from '../../lib/query-keys'

export function useOrders() {
  const queryClient = useQueryClient()

  const { data: orders = orderStore.getOrders(), isLoading, error, isFetching, refetch } = useQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: async () => {
      ensureOwner()
      const expectedOwner = accountId()
      const res = await api.order.list()
      if (expectedOwner !== accountId()) return []
      if (res.items) {
        const liveMapped: Order[] = res.items.map(mapDocToOrder)
        broadcast(liveMapped)
        return liveMapped
      }
      return orderStore.getOrders()
    },
    enabled: typeof window !== 'undefined' && Boolean(localStorage.getItem('persianpart_token')),
    staleTime: 30 * 1000,
  })

  const cancelMutation = useMutation({
    mutationKey: mutationKeys.orders.cancel,
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      return await orderStore.cancelOrder(orderId, reason)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })

  return {
    orders,
    isLoading,
    error,
    isFetching,
    refetch,
    getOrderById: orderStore.getOrderById,
    fetchOrderById: orderStore.fetchOrderById,
    createOrder: (payload: any) => {
      const created = orderStore.createOrder(payload)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      return created
    },
    updateOrder: (orderId: string, payload: any) => {
      const updated = orderStore.updateOrder(orderId, payload)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      return updated
    },
    cancelOrder: async (orderId: string, reason?: string) => {
      const res = await cancelMutation.mutateAsync({ orderId, reason })
      return res
    },

    reorderToCart: orderStore.reorderToCart,
  }
}
