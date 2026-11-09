import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CatalogRecordSchema } from '@persianpart/contract'
import { api, hasForegroundRequests } from '../../lib/api-client'
import { queryClient } from '../../lib/query-client'
import { queryKeys } from '../../lib/query-keys'
import { writeActivity } from '../../lib/write-activity'
import { useAuth } from '../auth/auth-store'
import { createCatalogCoordinator, emptyCatalog, type CatalogSnapshot } from './catalog-coordinator'
import { mapCatalogProduct } from './catalog-mapper'

const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0))
export const catalogCoordinator = createCatalogCoordinator(queryClient, {
  syncPage: (input, signal) => api.catalog.syncPage(input, { signal }),
  getByIds: (ids, signal) => api.catalog.getByIds({ ids }, { signal }),
  scan: async (scanCode, signal) => {
    const result = await api.catalog.getByScanCode({ scanCode }, { signal })
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scanCode))
    const scanHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    return CatalogRecordSchema.parse({ ...result, createdAt: 'createdAt' in result ? result.createdAt : new Date().toISOString(), scanHash })
  },
  browse: (input, signal) => api.catalog.browse(input, { signal }),
}, initial => document.visibilityState === 'visible' && navigator.onLine && !writeActivity.count() && (initial || !hasForegroundRequests()), yieldToUI)

window.addEventListener('persianpart:account-change', () => catalogCoordinator.reset())
window.addEventListener('persianpart:read-finished', () => { if (!catalogCoordinator.snapshot().error) void catalogCoordinator.resume() })
window.addEventListener('online', () => void catalogCoordinator.resume())
window.addEventListener('focus', () => void catalogCoordinator.resume())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void catalogCoordinator.resume() })
// One coordinator resumes paused work when foreground writes finish.
queryClient.getMutationCache().subscribe(event => {
  if (event.type === 'updated' && event.mutation.state.status !== 'pending' && !queryClient.isMutating()) void catalogCoordinator.resume()
})
window.addEventListener('persianpart:write-finished', () => { if (!catalogCoordinator.snapshot().error) void catalogCoordinator.resume() })

export function useCatalogData(start = false, mapAll = true) {
  const { user } = useAuth()
  const owner = user?.id ?? ''
  const result = useQuery<CatalogSnapshot>({ queryKey: queryKeys.products.catalog(owner), enabled: false, staleTime: Infinity, gcTime: Infinity })
  useEffect(() => {
    catalogCoordinator.setOwner(owner)
    if (owner) {
      if (start) void catalogCoordinator.start()
      else void catalogCoordinator.resume()
    }
  }, [owner, start])
  const state = result.data ?? emptyCatalog
  const products = useMemo(() => !mapAll ? [] : Object.values(state.byId).map(mapCatalogProduct).sort((a,b) => {
    const left = state.byId[a.id]!, right = state.byId[b.id]!
    return right.createdAt.localeCompare(left.createdAt) || Number(b.id) - Number(a.id)
  }), [state.byId, mapAll])
  return { state, products, owner }
}

export function useCatalogIds(ids: string[]) {
  const { state, owner } = useCatalogData(false, false)
  const signature = [...new Set(ids)].sort().join(',')
  const [status, setStatus] = useState<{ signature: string; error: unknown; done: boolean }>({ signature: '', error: null, done: false })
  useEffect(() => {
    if (!owner || !signature) return
    let active = true
    catalogCoordinator.ensureIds(signature.split(',')).then(() => {
      if (active) setStatus({ signature, error: null, done: true })
    }, error => { if (active) setStatus({ signature, error, done: true }) })
    return () => { active = false }
  }, [owner, signature, state.scopeKey])
  const selected = useMemo(() => ids.flatMap(id => state.byId[id] ? [mapCatalogProduct(state.byId[id]!)] : []), [state.byId, signature])
  const missing = ids.some(id => !state.byId[id])
  const failure = status.signature === signature ? status.error : null
  const error = failure ? failure instanceof Error ? failure : new Error('دریافت محصول ممکن نشد.') : missing && status.done && status.signature === signature ? new Error('یکی از محصولات در دسترس حساب شما نیست.') : null
  return { data: selected, raw: state.byId, error, isPending: missing && (!status.done || status.signature !== signature), isFetching: missing && (!status.done || status.signature !== signature), refetch: async () => {
    setStatus({ signature, error: null, done: false })
    try { await catalogCoordinator.ensureIds(ids, true); setStatus({ signature, error: null, done: true }) }
    catch (error) { setStatus({ signature, error, done: true }) }
  } }
}

export function useCatalogProduct(id: string | number | null | undefined) {
  const result = useCatalogIds(id ? [String(id)] : [])
  return { ...result, data: result.data[0] ?? null, isError: !!result.error }
}
