import { sdk, createPayloadSDK, type TypedPayloadSDK, type PayloadSdkOptions } from './sdk.js'
import type { Config, User } from './payload-types.js'
import { PayloadSDKError } from '@payloadcms/sdk'

export { sdk, createPayloadSDK, PayloadSDKError }
export type { TypedPayloadSDK, PayloadSdkOptions }

export type CollectionSlugs = keyof Config['collections']

export interface CrudOperations<T = any> {
  find: (args?: {
    where?: Record<string, any>
    limit?: number
    page?: number
    depth?: number
    sort?: string
    select?: Record<string, boolean>
  }) => Promise<{ docs: T[]; totalDocs: number; limit: number; totalPages: number; page: number }>
  findByID: (args: { id: string | number; depth?: number; select?: Record<string, boolean> }) => Promise<T>
  count: (args?: { where?: Record<string, any> }) => Promise<{ totalDocs: number }>
  create: (args: { data: Record<string, any>; depth?: number }) => Promise<T>
  update: (args: { id: string | number; data: Record<string, any>; depth?: number }) => Promise<T>
  delete: (args: { id: string | number }) => Promise<T>
}

// Lazy-loaded local Node.js Payload instance for offline scripts/migrations/seeds
let cachedLocalPayload: any = null

export async function getLocalPayloadClient() {
  if (!cachedLocalPayload) {
    const { getPayload } = await import('payload')
    const { default: config } = await import('./payload.config')
    cachedLocalPayload = await getPayload({ config })
  }
  return cachedLocalPayload
}

/**
 * Backward compatibility alias for offline scripts (e.g. seed.ts)
 */
export const getPayloadClient = getLocalPayloadClient

/**
 * Universal payload client:
 * - `sdk`: Direct instance of typed Payload REST API SDK (@payloadcms/sdk)
 * - `crud`: Collection-based CRUD proxy delegating all operations over the type-safe REST API SDK
 * - `client`: Lazy getter for local Node.js engine (seeds, migrations, local scripts)
 */
export const payload = {
  /**
   * The typed Payload REST API SDK instance
   */
  sdk,

  /**
   * Lazy getter for the in-process Node.js Payload instance
   */
  get client() {
    return getLocalPayloadClient()
  },

  /**
   * Collection-based CRUD proxy delegating to Payload REST API SDK
   */
  crud: new Proxy({} as Record<CollectionSlugs, CrudOperations>, {
    get: (_, collection: string) => ({
      find: async (opts: any = {}) => {
        return (await sdk.find({ collection: collection as any, ...opts })) as any
      },
      findByID: async ({ id, ...opts }: any) => {
        return (await sdk.findByID({ collection: collection as any, id, ...opts })) as any
      },
      count: async (opts: any = {}) => {
        return (await sdk.count({ collection: collection as any, ...opts })) as any
      },
      create: async ({ data, ...opts }: any) => {
        return (await sdk.create({ collection: collection as any, data, ...opts })) as any
      },
      update: async ({ id, data, ...opts }: any) => {
        return (await sdk.update({ collection: collection as any, id, data, ...opts })) as any
      },
      delete: async ({ id, ...opts }: any) => {
        return (await sdk.delete({ collection: collection as any, id, ...opts })) as any
      },
    }),
  }),
}

/**
 * Unified authentication helper over Payload REST API SDK
 * Resolves user from Authorization header (Admin JWT or Customer Bearer) or cookies.
 */
export async function payloadAuth(headers: Headers | Record<string, string>): Promise<User | null> {
  const getHeader = (name: string): string | null => {
    if (typeof (headers as any).get === 'function') {
      return (headers as Headers).get(name)
    }
    const record = headers as Record<string, string>
    return record[name] || record[name.toLowerCase()] || null
  }

  const authHeader = getHeader('authorization')
  const cookieHeader = getHeader('cookie')

  // 1. Try Admin auth if Authorization or Cookie present
  if (authHeader || cookieHeader) {
    try {
      const meResult = await sdk.me(
        { collection: 'admins' },
        {
          headers: {
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        },
      )
      if (meResult?.user) {
        const a = meResult.user
        if (a.isActive === false) return null
        return {
          id: a.id,
          phone: '',
          fullName: a.name || 'مدیر سیستم',
          role: a.role,
          status: a.isActive ? 'active' : 'suspended',
          updatedAt: a.updatedAt,
          createdAt: a.createdAt,
        } as unknown as User
      }
    } catch {
      // Ignored
    }
  }

  return null
}
