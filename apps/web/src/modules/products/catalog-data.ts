import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { CatalogRecordSchema } from '@persianpart/contract'
import { api, hasForegroundRequests } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { writeActivity } from '@/lib/write-activity'
import { authStore, useAuth } from '@/modules/auth/auth-store'
import { createCatalogCoordinator, emptyCatalog, type CatalogSnapshot } from './catalog-coordinator'
import { mapCatalogProduct } from './catalog-mapper'
import { createCatalogPersistence } from './_catalog-persistence'

const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const persistence = createCatalogPersistence(queryClient, owner => catalogCoordinator.discardStored(owner))
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
}, initial => document.visibilityState === 'visible' && navigator.onLine && !writeActivity.count() && (initial || !hasForegroundRequests()), yieldToUI, persistence)

const syncOwner = () => catalogCoordinator.setOwner(authStore.getState().user?.id ?? '')
syncOwner()
window.addEventListener('persianpart:account-change', syncOwner)
window.addEventListener('persianpart:read-finished', () => { if (!catalogCoordinator.snapshot().error) void catalogCoordinator.resume() })
window.addEventListener('online', () => void catalogCoordinator.resume())
window.addEventListener('focus', () => void catalogCoordinator.resume())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void catalogCoordinator.resume() })
// One coordinator resumes paused work when foreground writes finish.
queryClient.getMutationCache().subscribe(event => {
  if (event.type === 'updated' && event.mutation.state.status !== 'pending' && !queryClient.isMutating()) void catalogCoordinator.resume()
})
window.addEventListener('persianpart:write-finished', () => { if (!catalogCoordinator.snapshot().error) void catalogCoordinator.resume() })

function subscribeConnection(notify: () => void) {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

export function useCatalogData(start = false, mapAll = true) {
  const { user } = useAuth()
  const owner = user?.id ?? ''
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine)
  const result = useQuery<CatalogSnapshot>({
    queryKey: queryKeys.products.catalog(owner),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  })
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
  return { state, products, owner, online, isRestoring: !!owner && (!result.data || !!state.restoring) }
}

export function useCatalogIds(ids: string[]) {
  const { state, owner, online, isRestoring } = useCatalogData(false, false)
  const signature = [...new Set(ids)].sort().join(',')
  const requestKey = JSON.stringify([owner, state.scopeKey, signature])
  const [status, setStatus] = useState<{ key: string; error: unknown; done: boolean }>({ key: '', error: null, done: false })
  useEffect(() => {
    if (!owner || !signature || !online || isRestoring) return
    let active = true
    catalogCoordinator.ensureIds(signature.split(',')).then(() => {
      if (active) setStatus({ key: requestKey, error: null, done: true })
    }, error => { if (active) setStatus({ key: requestKey, error, done: true }) })
    return () => { active = false }
  }, [owner, signature, requestKey, online, isRestoring])
  const selected = useMemo(() => ids.flatMap(id => state.byId[id] ? [mapCatalogProduct(state.byId[id]!)] : []), [state.byId, signature])
  const missing = ids.some(id => !state.byId[id])
  const done = status.key === requestKey && status.done
  const failure = done ? status.error : null
  const offlineMissing = missing && !online && !isRestoring
  const error = offlineMissing ? new Error('برای دیدن این کالا به اینترنت وصل شوید.') : failure ? failure instanceof Error ? failure : new Error('دریافت محصول ممکن نشد.') : missing && done ? new Error('یکی از محصولات در دسترس حساب شما نیست.') : null
  const pending = missing && online && !isRestoring && !done
  return { data: selected, raw: state.byId, error, offlineMissing, isPending: pending, isFetching: pending, refetch: async () => {
    if (!navigator.onLine || isRestoring) return
    setStatus({ key: requestKey, error: null, done: false })
    try { await catalogCoordinator.ensureIds(ids, true); setStatus({ key: requestKey, error: null, done: true }) }
    catch (error) { setStatus({ key: requestKey, error, done: true }) }
  } }
}

export function useCatalogProduct(id: string | number | null | undefined) {
  const result = useCatalogIds(id ? [String(id)] : [])
  return { ...result, data: result.data[0] ?? null, isError: !!result.error }
}
