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

let foregroundRequests = 0
export const hasForegroundRequests = () => foregroundRequests > 0

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
  onCall: (segments, parentSignal) => {
    const token = localStorage.getItem('persianpart_token')
    const path = segments.join('/')
    const isWrite = /^(?:order\/(?:submit|cancel)|supplyRequest\/(?:submit|cancel)|shopping\/createOrder|user\/update|auth\/(?:verifyOtp|requestOtp))$/.test(path)
    const foreground = path !== 'catalog/syncPage' && path !== 'catalog/facets'
    if (foreground) foregroundRequests++
    const finishWrite = isWrite ? writeActivity.begin() : () => {}
    const controller = new AbortController()
    const abort = () => controller.abort(parentSignal?.reason)
    if (parentSignal?.aborted) abort()
    parentSignal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(() => controller.abort(new DOMException('زمان انتظار پایان یافت', 'TimeoutError')), 30_000)
    return {
      signal: controller.signal,
      assertCurrent() {
        if (token !== localStorage.getItem('persianpart_token')) throw new DOMException('حساب کاربری تغییر کرده است', 'AbortError')
      },
      finish(error) {
        clearTimeout(timeout)
        parentSignal?.removeEventListener('abort', abort)
        if (path === 'order/submit' && token === localStorage.getItem('persianpart_token')) {
          if (error) writeActivity.markUncertainOrder()
          else writeActivity.clearUncertainOrder()
        }
        finishWrite()
        if (foreground) { foregroundRequests--; if (!foregroundRequests) window.dispatchEvent(new Event('persianpart:read-finished')) }
        if (isWrite) window.dispatchEvent(new Event('persianpart:write-finished'))
      },
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
