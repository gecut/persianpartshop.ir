import type {
  CustomerProfile,
  CustomerType,
} from '@persianpart/contract'

export interface B2BCustomer {
  id: string
  name: string
  company: string
  phone: string
  tier: 'VIP' | 'تجاری ممتاز' | 'پروژه‌ای' | 'همکار' | 'عادی'
}

export interface Plan {
  id: string
  title: string
  customerGreeting: string
  customerId: string
  customerName: string
  type?: 'credit_terms' | 'product_discount' | 'informational'
  isActive: boolean
  isExpired?: boolean
  status?: 'active' | 'expired' | 'upcoming'
  content?: string
  productIds: string[]
  notes?: string
  hasTimer?: boolean
  startsAt?: string
  expiresAt?: string
  products?: any[]
  createdAt: string
}

export type {
  CustomerProfile,
  CustomerType,
}
