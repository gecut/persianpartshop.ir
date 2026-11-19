'use client'
import { useEffect } from 'react'

type CatalogRestorationOptions = {
  state: 'active' | 'paused' | undefined
  search: string
  pageCount: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}

export function useCatalogRestoration({
  state,
  search,
  pageCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: CatalogRestorationOptions) {
  useEffect(() => {
    if (!state || state !== 'active') return
    let saved: { search?: string; pages?: number; scrollY?: number } | null =
      null
    try {
      saved = JSON.parse(sessionStorage.getItem('catalog:view') ?? 'null')
    } catch {
      return
    }
    if (!saved || saved.search !== search) return
    if (
      (saved.pages ?? 1) > (pageCount ?? 0) &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage()
      return
    }
    if ((saved.pages ?? 1) <= (pageCount ?? 0) || !hasNextPage) {
      const frame = requestAnimationFrame(() => {
        window.scrollTo(0, Math.max(0, saved?.scrollY ?? 0))
        sessionStorage.removeItem('catalog:view')
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [state, search, pageCount, hasNextPage, isFetchingNextPage, fetchNextPage])
  return function saveView() {
    try {
      sessionStorage.setItem(
        'catalog:view',
        JSON.stringify({
          search,
          pages: pageCount ?? 1,
          scrollY: window.scrollY,
        }),
      )
    } catch {
      /* View restoration is optional when storage is unavailable. */
    }
  }
}
