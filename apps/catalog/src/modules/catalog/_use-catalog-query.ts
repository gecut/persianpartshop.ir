'use client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { PublicCatalogPage } from '@persianpart/contract/public-catalog'
import { browseCatalog } from '@/lib/catalog-client'
import {
  isDefaultCatalogSearch,
  parseCatalogSearch,
} from '@/lib/catalog-search'

function subscribe(notify: () => void) {
  window.addEventListener('popstate', notify)
  window.addEventListener('catalog:navigation', notify)
  return () => {
    window.removeEventListener('popstate', notify)
    window.removeEventListener('catalog:navigation', notify)
  }
}

class RevisionChanged extends Error {
  constructor(readonly revision: string) {
    super('Catalog revision changed')
  }
}
export function useCatalogQuery(initialPage: PublicCatalogPage) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  )
  const parsed = useMemo(() => {
    try {
      return { input: parseCatalogSearch(search), valid: true }
    } catch {
      return { input: parseCatalogSearch(''), valid: false }
    }
  }, [search])
  const [revision, setRevision] = useState(initialPage.revision)
  const [settledSearch, setSettledSearch] = useState(parsed.input.search)
  const client = useQueryClient()
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(parsed.input.search), 250)
    return () => clearTimeout(timer)
  }, [parsed.input.search])
  const key = ['public-catalog', revision, parsed.input] as const
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const result = await browseCatalog(
        { ...parsed.input, page: pageParam },
        { signal },
      )
      const first =
        client.getQueryData<InfiniteData<PublicCatalogPage>>(key)?.pages[0]
      if (pageParam > 1 && first && first.revision !== result.revision)
        throw new RevisionChanged(result.revision)
      return result
    },
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
    initialData:
      parsed.valid &&
      isDefaultCatalogSearch(parsed.input) &&
      revision === initialPage.revision
        ? { pages: [initialPage], pageParams: [1] }
        : undefined,
    enabled: parsed.valid && settledSearch === parsed.input.search,
    retry: (count, error) => !(error instanceof RevisionChanged) && count < 1,
  })
  useEffect(() => {
    if (query.error instanceof RevisionChanged)
      setRevision(query.error.revision)
  }, [query.error])
  return { search, parsed, query }
}
