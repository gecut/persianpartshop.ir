import type { RouterContractClient } from '@orpc/contract'
import { createORPCClient, ORPCError } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { appContract } from '@persianpart/contract'

export function createApiClient(options: {
  baseURL?: string
  fetch?: typeof globalThis.fetch
  getToken?: () => string | null
  onAuthError?: (error: unknown) => void
  onCall?: (path: string[], signal?: AbortSignal) => { signal: AbortSignal; finish: (error?: unknown) => void; assertCurrent: () => void }
}) {
  const origin = options.baseURL
    ? (options.baseURL.replace(/\/$/, '') as `http://${string}` | `https://${string}`)
    : undefined

  const link = new RPCLink({
    origin,
    url: '/api/rpc',
    interceptors: [async ({ next, ...callOptions }) => {
      const token = options.getToken?.()
      const call = options.onCall?.(callOptions.path, callOptions.signal)
      let failure: unknown
      try {
        const result = await next(call ? { ...callOptions, signal: call.signal } : callOptions)
        if (token !== options.getToken?.()) throw new DOMException('Account changed', 'AbortError')
        call?.assertCurrent()
        return result
      } catch (error) {
        failure = error
        if (token !== options.getToken?.()) throw new DOMException('Account changed', 'AbortError')
        call?.assertCurrent()
        if (error instanceof ORPCError) {
          const data = error.data && typeof error.data === 'object' ? error.data : null
          const banned = error.code === 'FORBIDDEN' && ((data && 'code' in data && data.code === 'USER_BANNED') || error.message.includes('توسط مدیریت مسدود') || error.message.includes('مسدود گردید'))
          if (error.code === 'UNAUTHORIZED' || banned) options.onAuthError?.(error)
        }
        throw error
      }
      finally { call?.finish(failure) }
    }],
    headers: () => {
      const token = options.getToken?.()
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
        }
      }
      return {}
    },
    fetch: options.fetch ?? globalThis.fetch,
  })

  const client: RouterContractClient<typeof appContract> = createORPCClient(link)
  return client
}

export { appContract, appContract as contract }
export type ApiClient = RouterContractClient<typeof appContract>
