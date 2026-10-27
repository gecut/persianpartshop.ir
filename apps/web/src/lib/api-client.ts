import { createApiClient } from '@persianpart/api/client'
import type { AppRouter, ApiClient } from '@persianpart/api'

// In browser, always use current origin so requests route via Vite's proxy seamlessly
// regardless of whether the app is accessed via localhost, 127.0.0.1, or network IP
const defaultBaseUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5175'

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
  
  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('persianpart_token')
    }
    return null
  },
})

if(api===null) {alert('اتصال به سرور برقرار نشد. لطفا اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.')}

export type { AppRouter, ApiClient }
export { appContract } from '@persianpart/contract'
export type {
  AppContract,
  CustomerProfile,
  CustomerType,
  Product,
  CatalogProduct,
  AvailabilityBadge,
  ValidatedCartItem,
  ValidateCartOutput,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  OrderTimelineEvent,
  PrepareReorderOutput,
} from '@persianpart/contract'
