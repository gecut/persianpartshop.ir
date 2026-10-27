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
  discountPercent?: number
  discountAmount?: number
  isActive: boolean
  status?: 'active' | 'expired' | 'draft' | 'completed' | 'successful'
  content?: string
  productIds: string[]
  notes?: string
  hasTimer?: boolean
  expiresAt?: string
  createdAt: string
}

export type {
  CustomerProfile,
  CustomerType,
}
