import 'server-only'
import { cache } from 'react'
import { readCatalogCMS } from './catalog-cms'

export function catalogOrigin(): string {
  if (!process.env.CATALOG_URL)
    throw new Error('CATALOG_URL must be configured at runtime')
  return new URL(process.env.CATALOG_URL).origin
}
const cachedRead = { cache: 'force-cache', next: { revalidate: 300 } } as const
export const getCatalog = cache(() =>
  readCatalogCMS('bootstrap', {}, cachedRead),
)
export const getProduct = cache((id: number) =>
  readCatalogCMS('product', { id }, cachedRead),
)
