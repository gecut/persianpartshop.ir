import { hashKey } from '@tanstack/react-query'
import { CatalogBrowseInputSchema, type CatalogBrowseInput } from '@persianpart/contract'
import { queryKeys } from '@/lib/query-keys'

export const { page: firstBrowsePage, ...defaultBrowseFilters } = CatalogBrowseInputSchema.parse({})

export const defaultBrowseKey = (owner: string) => queryKeys.products.browse(owner, defaultBrowseFilters)

export function isDefaultBrowse(filters: Omit<CatalogBrowseInput, 'page'>) {
  return hashKey(queryKeys.products.browse('', filters)) === hashKey(defaultBrowseKey(''))
}
