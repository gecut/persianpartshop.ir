import type { RouterContractClient } from '@orpc/contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { appContract } from '@persianpart/contract'

export function createApiClient(options: {
  baseURL?: string
  getToken?: () => string | null
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
  })

  const client: RouterContractClient<typeof appContract> = createORPCClient(link)
  return client
}

export { appContract, appContract as contract }
export type ApiClient = RouterContractClient<typeof appContract>
