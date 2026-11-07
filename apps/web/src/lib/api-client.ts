import { writeActivity } from './write-activity'
import { createApiClient } from '@persianpart/api/client'
import type { AppRouter, ApiClient } from '@persianpart/api'

// In browser, always use current origin so requests route via Vite's proxy seamlessly
// regardless of whether the app is accessed via localhost, 127.0.0.1, or network IP
const defaultBaseUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5175'

let onAuthErrorCallback: ((err: any) => void) | null = null

export function setAuthErrorHandler(fn: (err: any) => void) {
  onAuthErrorCallback = fn
}

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
  fetch: async (input, init) => {
    const token = localStorage.getItem('persianpart_token')
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const isWrite = /\/(?:order\/(?:submit|cancel)|shopping\/createOrder|user\/update|auth\/(?:verifyOtp|requestOtp))/.test(path)
    const finish = isWrite ? writeActivity.begin() : () => {}
    const controller = new AbortController()
    const abort = () => controller.abort(init?.signal?.reason)
    if (init?.signal?.aborted) abort()
    init?.signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(() => controller.abort(new DOMException('زمان انتظار پایان یافت', 'TimeoutError')), 30_000)
    try {
      const response = await fetch(input, { ...init, signal: controller.signal })
      await response.clone().arrayBuffer()
      if (token !== localStorage.getItem('persianpart_token')) throw new DOMException('حساب کاربری تغییر کرده است', 'AbortError')
      if (/\/order\/submit/.test(path) && response.ok) writeActivity.clearUncertainOrder()
      return response
    } catch (error) {
      if (/\/order\/submit/.test(path)) writeActivity.markUncertainOrder()
      throw error
    } finally {
      clearTimeout(timeout)
      init?.signal?.removeEventListener('abort', abort)
      finish()
    }
  },
  
  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('persianpart_token')
    }
    return null
  },

  onAuthError: (err) => {
    onAuthErrorCallback?.(err)
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
