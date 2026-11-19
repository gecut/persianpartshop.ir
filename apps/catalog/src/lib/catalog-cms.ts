import 'server-only'
import { PayloadSDK, PayloadSDKError } from '@payloadcms/sdk'
import {
  catalogOperations,
  type CatalogInput,
  type CatalogOperation,
  type CatalogOutput,
} from '@persianpart/contract/public-catalog'

export function createCatalogCMSClient({
  baseURL,
  apiKey,
  fetch: transport = fetch,
}: {
  baseURL: string
  apiKey: string
  fetch?: typeof fetch
}) {
  if (!apiKey) throw new Error('CMS_API_KEY must be configured server-side')
  return new PayloadSDK({
    baseURL: baseURL.replace(/\/+$/, ''),
    baseInit: {
      headers: { Authorization: `admins API-Key ${apiKey}` },
      credentials: 'omit',
    },
    fetch: (input, init) =>
      transport(input, {
        ...init,
        signal: AbortSignal.any([
          ...(init?.signal ? [init.signal] : []),
          AbortSignal.timeout(10000),
        ]),
      }),
  })
}

export async function readCatalogCMS<K extends CatalogOperation>(
  operation: K,
  input: CatalogInput<K>,
  init: RequestInit = {},
) {
  if (!process.env.CMS_API_URL)
    throw new Error('CMS_API_URL must be configured at runtime')
  const sdk = createCatalogCMSClient({
    baseURL: process.env.CMS_API_URL,
    apiKey: process.env.CMS_API_KEY || '',
  })
  const response = await sdk.request({
    path: `/catalog/${operation}`,
    method: 'POST',
    json: catalogOperations[operation].input.parse(input),
    init,
  })
  // The operation key selects both schemas at this trust boundary.
  return catalogOperations[operation].output.parse(
    await response.json(),
  ) as CatalogOutput<K>
}

export function isCatalogNotFound(error: unknown): boolean {
  return (
    error instanceof PayloadSDKError &&
    error.status === 404 &&
    error.errors.some(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        'code' in item &&
        item.code === 'CATALOG_NOT_FOUND',
    )
  )
}
