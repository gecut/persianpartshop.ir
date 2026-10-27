import type {
  OrderStatus as ContractOrderStatus,
  OrderTimelineEvent as ContractTimelineEvent,
  TimelineActorType,
  TimelineEventType,
} from '@persianpart/contract'

export type OrderStatus =
  | 'pending'
  | 'approve'
  | 'approved'
  | 'cancel'
  | 'cancelled'
  | 'checking'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_admin'
  | 'preparing'
  | 'processing'
  | 'ready'

export interface OrderItem {
  productId: string
  productName: string
  productSlug: string
  productSku: string
  productImage: string
  dimension: string
  unitPrice: number
  requestedArea: number
  cartonCount: number
  deliverableArea: number
  totalPrice: number
}

export interface TimelineStep {
  id: string
  title: string
  description: string
  timestamp?: string
  status: 'completed' | 'current' | 'pending' | 'cancelled'
}

export interface Order {
  id: string
  orderNumber: string
  date: string
  createdAt?: string
  updatedAt?: string
  status: OrderStatus
  cancelledBy?: 'customer' | 'admin'
  statusLabel: string
  storeName: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  notes?: string
  cancellationDeadline?: string
  items: OrderItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  finalTotal: number
  timeline: TimelineStep[]
}

export const ORDER_STATUS_MAP: Record<
  string,
  { label: string; color: 'warning' | 'primary' | 'secondary' | 'success' | 'danger' | 'default' }
> = {
  pending: { label: 'سفارش ثبت شده', color: 'primary' },
  completed: { label: 'تکمیل شده', color: 'success' },
  cancelled_by_customer: { label: 'لغو توسط کاربر', color: 'danger' },
  cancelled_by_admin: { label: 'لغو توسط ادمین', color: 'danger' },
  approve: { label: 'تکمیل شده', color: 'success' },
  approved: { label: 'تکمیل شده', color: 'success' },
  cancel: { label: 'لغو شده', color: 'danger' },
  cancelled: { label: 'لغو شده', color: 'danger' },
  checking: { label: 'در حال بررسی واحد بازرگانی', color: 'warning' },
  preparing: { label: 'در حال بررسی واحد بازرگانی', color: 'warning' },
  processing: { label: 'در حال بررسی واحد بازرگانی', color: 'warning' },
  ready: { label: 'تکمیل شده', color: 'success' },
}

export type { ContractOrderStatus, ContractTimelineEvent, TimelineActorType, TimelineEventType }
