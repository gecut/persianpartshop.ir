import { PayloadSDK, PayloadSDKError } from '@payloadcms/sdk'
import type { Config } from './payload-types.js'

export { PayloadSDK, PayloadSDKError }
export type TypedPayloadSDK = PayloadSDK<Config>
export type { Config }

export interface PayloadSdkOptions {
  /**
   * Base API URL for Payload REST API.
   * Defaults to CMS_API_URL or `${CMS_URL || 'http://localhost:5174'}/api`
   * @example 'http://localhost:5174/api'
   */
  baseURL?: string

  /**
   * Optional API Key for service-to-service authentication
   */
  apiKey?: string

  /**
   * Optional default JWT Bearer token
   */
  token?: string

  /**
   * Base RequestInit for all requests (credentials, headers, etc.)
   */
  baseInit?: RequestInit

  /**
   * Custom fetch implementation
   */
  fetch?: typeof fetch

  /**
   * Request timeout in milliseconds (default: 10,000ms)
   */
  timeoutMs?: number

  /**
   * Maximum retry attempts on transient network errors (default: 2)
   */
  maxRetries?: number
}

function resolveDefaultBaseURL(): string {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.CMS_API_URL) return process.env.CMS_API_URL
    if (process.env.PAYLOAD_URL) return `${process.env.PAYLOAD_URL.replace(/\/+$/, '')}/api`
    if (process.env.CMS_URL) return `${process.env.CMS_URL.replace(/\/+$/, '')}/api`
    if (process.env.NEXT_PUBLIC_SERVER_URL) {
      return `${process.env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}/api`
    }
  }
  return 'http://localhost:5174/api'
}

/**
 * Creates a resilient fetch wrapper with timeout, retries, and informative error handling
 */
function createResilientFetch(options: PayloadSdkOptions): typeof fetch {
  const customFetch = options.fetch || globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxRetries = options.maxRetries ?? 2

  const resilientFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let lastError: unknown = null
    const targetUrl = url instanceof Request ? url.url : url.toString()
    const method = (init?.method ?? (url instanceof Request ? url.method : 'GET')).toUpperCase()
    const callerSignal = init?.signal !== undefined
      ? init.signal
      : url instanceof Request ? url.signal : undefined
    callerSignal?.throwIfAborted()
    const isSafeRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
    const effectiveRetries = isSafeRead ? maxRetries : 0

    for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
      callerSignal?.throwIfAborted()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)
      const signal = callerSignal
        ? AbortSignal.any([callerSignal, controller.signal])
        : controller.signal

      try {
        const response = await customFetch(url, { ...init, signal })
        callerSignal?.throwIfAborted()
        if (![502, 503, 504].includes(response.status) || attempt >= effectiveRetries) {
          return response
        }
        await response.body?.cancel()
      } catch (err: unknown) {
        callerSignal?.throwIfAborted()
        lastError = err
        if (controller.signal.aborted) {
          if (attempt >= effectiveRetries) {
            const message = `Payload SDK request timed out after ${timeoutMs}ms: [${method}] ${targetUrl}`
            throw new PayloadSDKError({
              errors: [{ message }],
              message,
              response: new Response(null, { status: 504 }),
              status: 504,
            })
          }
        } else if (err instanceof Error && err.name === 'AbortError') {
          throw err
        }
        if (attempt >= effectiveRetries) break
      } finally {
        clearTimeout(timeoutId)
      }

      const backoff = Math.min(100 * Math.pow(2, attempt) + Math.random() * 50, 1000)
      await sleep(backoff, callerSignal)
    }

    const errorMsg = lastError instanceof Error ? lastError.message : String(lastError)
    throw new PayloadSDKError({
      errors: [{ message: errorMsg }],
      message: `Payload SDK network failure connecting to ${targetUrl}: ${errorMsg}. Ensure CMS is running at ${options.baseURL || resolveDefaultBaseURL()}`,
      response: new Response(null, { status: 503 }),
      status: 503,
    })
  }

  return resilientFetch as typeof fetch
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Factory to create a fully type-safe PayloadSDK instance for PersianPart CMS
 */
export function createPayloadSDK(options: PayloadSdkOptions = {}): TypedPayloadSDK {
  const baseURL = options.baseURL || resolveDefaultBaseURL()
  const resilientFetch = createResilientFetch({ ...options, baseURL })

  const baseHeaders: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.apiKey || (typeof process !== 'undefined' && process.env?.CMS_API_KEY)) {
    const key = options.apiKey || process.env.CMS_API_KEY
    baseHeaders['Authorization'] = `admins API-Key ${key}`
  } else if (options.token) {
    baseHeaders['Authorization'] = `Bearer ${options.token}`
  }

  const baseInit: RequestInit = {
    ...options.baseInit,
    headers: {
      ...baseHeaders,
      ...(options.baseInit?.headers as Record<string, string>),
    },
  }

  return new PayloadSDK<Config>({
    baseURL,
    baseInit,
    fetch: resilientFetch,
  })
}

/**
 * Singleton instance configured for PersianPart CMS
 */
export const sdk: TypedPayloadSDK = createPayloadSDK()
