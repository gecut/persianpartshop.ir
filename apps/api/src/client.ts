import type { RouterContractClient } from '@orpc/contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { appContract } from '@persianpart/contract'

export function createApiClient(options: {
  baseURL?: string
  getToken?: () => string | null
  onAuthError?: (error: any) => void
}) {
  const origin = options.baseURL
    ? (options.baseURL.replace(/\/$/, '') as `http://${string}` | `https://${string}`)
    : undefined

  const link = new RPCLink({
    origin,
    url: '/api/rpc',
    headers: () => {
      const token = options.getToken?.()
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
        }
      }
      return {}
    },
    fetch: async (url, init) => {
      const response = await globalThis.fetch(url, init)
      if (response.status === 401) {
        try {
          const clone = response.clone()
          const data = await clone.json()
          options.onAuthError?.(data)
        } catch {
          options.onAuthError?.({ status: 401 })
        }
      } else if (response.status === 403) {
        try {
          const clone = response.clone()
          const data: any = await clone.json()
          const msg = data?.message || data?.error?.message || ''
          const isBanned =
            data?.data?.code === 'USER_BANNED' ||
            data?.error?.data?.code === 'USER_BANNED' ||
            msg.includes('توسط مدیریت مسدود') ||
            msg.includes('مسدود گردید')
          if (isBanned) {
            options.onAuthError?.(data)
          }
        } catch {
          // Non-banned 403 error; let procedure caller handle business failure
        }
      }
      return response
    },
  })

  const client: RouterContractClient<typeof appContract> = createORPCClient(link)
  return client
}

export { appContract, appContract as contract }
export type ApiClient = RouterContractClient<typeof appContract>
