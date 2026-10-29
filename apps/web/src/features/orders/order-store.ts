import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type Order, type OrderItem, type TimelineStep } from '../../types'
import { cartStore } from '../cart/cart-store'
import { api } from '../../lib/api-client'
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
  force10MinutesPassed?: boolean
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
  const deadlineMs = createdAtMs + 10 * 60 * 1000

  const is10MinutesPassed = force10MinutesPassed ?? (Date.now() >= deadlineMs)
  const isApproved = status === 'completed' || status === 'approve' || status === 'approved'

  // Cancellation Flow
  if (isCancelled) {
    const cancelTitle = isCancelledByCustomer ? 'لغو توسط کاربر' : 'لغو توسط ادمین'

    const cancelDesc = isCancelledByCustomer
      ? doc.notes || 'سفارش در مهلت ۱۰ دقیقه توسط کاربر لغو گردید.'
      : doc.notes || 'سفارش توسط واحد بازرگانی / ادمین لغو گردید.'

    const steps: TimelineStep[] = [
      {
        id: 'step-1',
        title: 'سفارش ثبت شده',
        description: 'سفارش با موفقیت در سامانه ثبت گردید (مهلت ۱۰ دقیقه جهت لغو توسط کاربر).',
        timestamp: formatTs(doc.createdAt) || pDate,
        status: 'completed',
      },
    ]

    if (is10MinutesPassed) {
      steps.push({
        id: 'step-2',
        title: 'در حال بررسی واحد بازرگانی',
        description: 'مهلت ۱۰ دقیقه سپری شده و سفارش در صف بررسی واحد بازرگانی قرار گرفته بود.',
        timestamp: formatTs(new Date(createdAtMs + 10 * 60 * 1000).toISOString()),
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
  // Stage 1: سفارش ثبت شده (تایمر ۱۰ دقیقه)
  // Stage 2: در حال بررسی واحد بازرگانی (پس از اتمام ۱۰ دقیقه)
  // Stage 3: تکمیل شده (صدور حواله نهایی)
  const step1Status: 'completed' = 'completed'
  const step2Status: 'completed' | 'current' = (isApproved || is10MinutesPassed) ? 'completed' : 'current'
  const step3Status: 'completed' | 'current' | 'pending' = isApproved ? 'completed' : is10MinutesPassed ? 'current' : 'pending'

  const step1Timestamp = formatTs(doc.createdAt) || pDate
  const step2Timestamp = (isApproved || is10MinutesPassed)
    ? formatTs(new Date(createdAtMs + 10 * 60 * 1000).toISOString())
    : '۱۰ دقیقه پس از ثبت سفارش'
  const step3Timestamp = isApproved
    ? formatTs(doc.updatedAt || doc.createdAt) || pDate
    : undefined

  return [
    {
      id: 'step-1',
      title: 'سفارش ثبت شده',
      description: 'سفارش در سامانه ثبت شد و کاربر تا ۱۰ دقیقه امکان لغو آن را دارد.',
      timestamp: step1Timestamp,
      status: step1Status,
    },
    {
      id: 'step-2',
      title: 'در حال بررسی واحد بازرگانی',
      description: (isApproved || is10MinutesPassed)
        ? 'مهلت ۱۰ دقیقه به پایان رسید و سفارش در دست بررسی کارشناسان واحد بازرگانی قرار گرفت.'
        : 'پس از اتمام مهلت ۱۰ دقیقه‌ای کاربر، سفارش وارد بررسی واحد بازرگانی خواهد شد.',
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
  const deadlineMs = createdAtMs + 10 * 60 * 1000
  const is10MinutesPassed = Date.now() >= deadlineMs

  let statusLabel = 'سفارش ثبت شده'
  if (normalizedStatus === 'pending') {
    statusLabel = is10MinutesPassed ? 'در حال بررسی واحد بازرگانی' : 'سفارش ثبت شده'
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
    const width = prod?.width || 60
    const height = prod?.height || 120
    const cdnUrl = import.meta.env.VITE_CDN_URL
    const coverUrl =
      prod?.cover?.url ||
      (prod?.cover?.filename && cdnUrl ? `${cdnUrl}/${encodeURIComponent(prod.cover.filename)}` : '') ||
      (prod?.cover?.filename ? `/api/media/file/${prod.cover.filename}` : '') ||
      (typeof prod?.cover === 'string' && prod.cover.startsWith('/') ? prod.cover : '') ||
      '/assets/images/placeholder.svg'
    return {
      productId: String(prod?.id || i.product || ''),
      productName: prod?.name || 'قطعه',
      productSlug: prod?.slug || '',
      productSku: prod?.sku || '',
      productImage: coverUrl,
      dimension: `${width}×${height}`,
      requestedArea: i.requestedArea || 1,
      cartonCount: i.cartonCount || 1,
      deliverableArea: i.deliverableArea || 1,
      unitPrice: i.unitPrice || 0,
      totalPrice: i.totalPrice || 0,
    }
  })

  const timeline = buildFullOrderTimeline(doc, persianDate, is10MinutesPassed)

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
    deliveryAddress: doc.deliveryAddress || userObj?.address || 'انبار مرکزی بازرگانی دهقان',
    notes: doc.notes || '',
    cancellationDeadline: new Date(createdAtMs + 10 * 60 * 1000).toISOString(),
    items,
    subtotal: doc.subtotal || 0,
    discountAmount: doc.discountAmount || 0,
    taxAmount: doc.taxAmount || 0,
    finalTotal: doc.finalTotal || doc.subtotal || 0,
    timeline,
  }
}

export const orderStore = {
  getOrders: () => currentOrders,
  getOrderById: (id: string) => currentOrders.find((o) => o.id === id || o.orderNumber === id),

  fetchOrderById: async (id: string): Promise<Order | null> => {
    const existing = currentOrders.find((o) => o.id === id || o.orderNumber === id)
    if (existing) return existing

    try {
      const doc: any = await api.order.getById({ id })
      if (doc && doc.id) {
        const order = mapDocToOrder(doc)
        const updated = [order, ...currentOrders.filter((o) => o.id !== order.id)]
        broadcast(updated)
        return order
      }
    } catch (err) {
      console.warn('fetchOrderById error:', err)
    }
    return null
  },

  syncFromApi: async () => {
    try {
      const res = await api.order.list()
      if (res.items && res.items.length > 0) {
        const liveMapped: Order[] = res.items.map(mapDocToOrder)
        broadcast(liveMapped)
      }
    } catch {
      // Keep existing orders if API fails
    }
  },

  createOrder: (payload: {
    id?: string
    orderNumber?: string
    items: OrderItem[]
    subtotal: number
    discountAmount: number
    taxAmount: number
    finalTotal: number
    deliveryAddress: string
    notes?: string
  }): Order => {
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    const newId = payload.id || `${randomNum}`
    const cleanId = String(newId).replace(/^ord-/, "").replace(/^ptp\s*/i, "")
    const orderNumber = payload.orderNumber || `ptp ${cleanId}`
    const now = new Date()
    const isoString = now.toISOString()
    const persianDate = formatPersianDate(now)
    const deadlineIso = new Date(now.getTime() + 10 * 60 * 1000).toISOString()
    const timeline = buildFullOrderTimeline(
      {
        status: 'pending',
        createdAt: isoString,
      },
      persianDate,
      false
    )

    const newOrder: Order = {
      id: newId,
      orderNumber,
      date: persianDate,
      createdAt: isoString,
      cancellationDeadline: deadlineIso,
      status: 'pending',
      statusLabel: 'سفارش ثبت شده',
      storeName: 'بازرگانی دهقان (پرشین پارت تهران)',
      customerName: 'آرش دهقان',
      customerPhone: '۰۹۱۲۳۴۵۶۷۸۹',
      deliveryAddress: payload.deliveryAddress,
      notes: payload.notes,
      items: payload.items,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      taxAmount: payload.taxAmount,
      finalTotal: payload.finalTotal,
      timeline,
    }

    const updated = [newOrder, ...currentOrders]
    broadcast(updated)
    cartStore.clearCart()

    // Persist order to backend API only if it was not already created on the server
    if (!payload.id) {
      try {
        api.order
          .submit({
            items: payload.items.map((i) => ({
              productId: i.productId,
              requestedArea: i.deliverableArea || i.requestedArea || 1,
              requestedSqm: i.deliverableArea || i.requestedArea || 1,
            })),
            notes: payload.notes || 'ثبت سفارش محصولات آنلاین',
          })
          .then((res: any) => {
            if (res && res.id) {
              const serverId = String(res.id)
              const serverOrderNumber = res.orderNumber || `ptp ${serverId}`
              const synced = currentOrders.map((o) =>
                o.id === newOrder.id
                  ? { ...o, id: serverId, orderNumber: serverOrderNumber }
                  : o
              )
              broadcast(synced)
            }
          })
          .catch((err) => {
            console.warn('[ORDER_SYNC_BACKEND]: Fallback to local storage:', err)
          })
      } catch (err) {
        console.warn('[ORDER_SYNC_BACKEND]: Dispatch error:', err)
      }
    }

    return newOrder
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
    let updatedOrder: Order | null = null
    const updated = currentOrders.map((order) => {
      if (order.id === orderId || order.orderNumber === orderId) {
        updatedOrder = {
          ...order,
          items: payload.items,
          subtotal: payload.subtotal,
          discountAmount: payload.discountAmount,
          taxAmount: payload.taxAmount,
          finalTotal: payload.finalTotal,
          notes: payload.notes || order.notes,
        }
        return updatedOrder
      }
      return order
    })
    if (updatedOrder) {
      broadcast(updated)
      return updatedOrder
    }
    return null
  },

  cancelOrder: async (orderId: string, reason?: string): Promise<boolean> => {
    try {
      const numericId = !isNaN(Number(orderId)) ? Number(orderId) : orderId
      await api.order.cancel({ id: numericId, reason })
    } catch (err: any) {
      console.warn('API cancelOrder warning:', err?.message || err)
    }

    const updated = currentOrders.map((order) => {
      if (order.id === orderId || order.orderNumber === orderId) {
        return mapDocToOrder({
          ...order,
          status: 'cancelled_by_customer',
          cancelledBy: 'customer',
          statusLabel: 'لغو توسط کاربر',
          notes: reason ? `دلیل لغو کاربر: ${reason}` : 'لغو توسط کاربر',
          updatedAt: new Date().toISOString(),
        })
      }
      return order
    })
    broadcast(updated)
    return true
  },

  reactivateOrder: async (orderId: string): Promise<Order | null> => {
    let updatedOrder: Order | null = null
    const updated = currentOrders.map((order) => {
      if (order.id === orderId || order.orderNumber === orderId) {
        updatedOrder = mapDocToOrder({
          ...order,
          status: 'pending',
          statusLabel: 'سفارش ثبت شده',
          cancelledBy: null,
          notes: 'راه‌اندازی مجدد سفارش توسط مشتری',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
        return updatedOrder
      }
      return order
    })

    if (!updatedOrder) {
      const existing = orderStore.getOrderById(orderId)
      if (existing) {
        updatedOrder = {
          ...existing,
          status: 'pending',
          statusLabel: 'سفارش ثبت شده',
          cancelledBy: undefined,
          notes: 'راه‌اندازی مجدد سفارش توسط مشتری',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
        updated.push(updatedOrder)
      }
    }

    broadcast(updated)
    return updatedOrder
  },

  reorderToCart: (orderId: string): { success: boolean; warnings: string[] } => {
    const order = currentOrders.find((o) => o.id === orderId)
    if (!order) return { success: false, warnings: ['سفارش یافت نشد.'] }

    if (order.status === 'cancelled' || order.status === 'cancelled_by_customer' || order.status === 'cancelled_by_admin') {
      return { success: false, warnings: ['این سفارش لغو شده است و امکان سفارش مجدد آن وجود ندارد.'] }
    }

    const warnings: string[] = []

    // Populate cart with order items
    order.items.forEach((item) => {
      const productObj: any = {
        id: item.productId,
        name: item.productName,
        slug: item.productSlug,
        sku: item.productSku,
        dimension: item.dimension,
        images: [item.productImage],
        finalCustomerPricePerSqm: item.unitPrice,
        sqmPerCarton: item.deliverableArea / (item.cartonCount || 1),
        stockCartons: 999,
        inventorySqm: 999,
      }
      cartStore.addItem(productObj, item.requestedArea)
    })

    return { success: true, warnings }
  },
}

import { queryKeys, mutationKeys } from '../../lib/query-keys'

export function useOrders() {
  const queryClient = useQueryClient()

  const { data: orders = orderStore.getOrders(), isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: async () => {
      const res = await api.order.list()
      if (res.items && res.items.length > 0) {
        const liveMapped: Order[] = res.items.map(mapDocToOrder)
        broadcast(liveMapped)
        return liveMapped
      }
      return orderStore.getOrders()
    },
    staleTime: 30 * 1000,
  })

  const cancelMutation = useMutation({
    mutationKey: mutationKeys.orders.cancel,
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      return await orderStore.cancelOrder(orderId, reason)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })

  return {
    orders,
    isLoading,
    refetch,
    getOrderById: orderStore.getOrderById,
    fetchOrderById: orderStore.fetchOrderById,
    createOrder: (payload: any) => {
      const created = orderStore.createOrder(payload)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      return created
    },
    updateOrder: (orderId: string, payload: any) => {
      const updated = orderStore.updateOrder(orderId, payload)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      return updated
    },
    cancelOrder: async (orderId: string, reason?: string) => {
      const res = await cancelMutation.mutateAsync({ orderId, reason })
      return res
    },
    reactivateOrder: async (orderId: string) => {
      const res = await orderStore.reactivateOrder(orderId)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      return res
    },
    reorderToCart: orderStore.reorderToCart,
  }
}
