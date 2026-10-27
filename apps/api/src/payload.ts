import { sdk, createPayloadSDK, PayloadSDKError, type TypedPayloadSDK, type PayloadSdkOptions, type Config } from '@persianpart/cms/sdk'
import { payload, payloadAuth, type CollectionSlugs, type CrudOperations } from '@persianpart/cms/payload'
import { ORPCError } from '@orpc/server'

export { sdk, createPayloadSDK, PayloadSDKError, payload, payloadAuth }
export type { TypedPayloadSDK, PayloadSdkOptions, Config, CollectionSlugs, CrudOperations }

/**
 * Handles errors thrown by Payload REST API SDK and maps them into standard oRPC errors
 */
export function handlePayloadError(err: unknown): never {
  if (err instanceof PayloadSDKError) {
    if (err.status === 404) {
      throw new ORPCError('NOT_FOUND', { message: err.message })
    }
    if (err.status === 401) {
      throw new ORPCError('UNAUTHORIZED', { message: err.message })
    }
    if (err.status === 403) {
      throw new ORPCError('FORBIDDEN', { message: err.message })
    }
    if (err.status === 400) {
      throw new ORPCError('BAD_REQUEST', { message: err.message })
    }
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: err.message })
  }

  if (err instanceof ORPCError) {
    throw err
  }

  throw new ORPCError('INTERNAL_SERVER_ERROR', {
    message: err instanceof Error ? err.message : 'خطای ارتباط با سامانه مدیریت محتوا',
  })
}
