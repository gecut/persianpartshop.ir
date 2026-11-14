import { useEffect, useMemo, useState } from 'react'
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
import { offlinePackageSnapshot, useOfflinePackage } from '@/modules/pwa/offline-package'
import { useOnline } from '@/lib/use-online'

const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const persistence = createCatalogPersistence(queryClient, owner => catalogCoordinator.discardStored(owner))
const offlineScanIndexes = new WeakMap<object, Record<string, string>>()

function offlineScanIndex(products: CatalogSnapshot['byId']) {
  let index = offlineScanIndexes.get(products)
  if (!index) {
    index = Object.fromEntries(Object.values(products).flatMap(record => record.scanHash ? [[record.scanHash, String(record.id)]] : []))
    offlineScanIndexes.set(products, index)
  }
  return index
}
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

export function useCatalogData(start = false) {
  const { user } = useAuth()
  const owner = user?.id ?? ''
  const online = useOnline()
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
  const offline = useOfflinePackage()
  const pack = !online && offline.active?.owner === owner ? offline.active : undefined
  const state = useMemo(() => {
    if (!pack) return result.data ?? emptyCatalog
    const scanIndex = offlineScanIndex(pack.data.products)
    return { ...emptyCatalog, byId: pack.data.products, scanIndex, scopeKey: pack.scopeKey, complete: true, completedAt: pack.completedAt ?? 0 }
  }, [pack, result.data])
  return { state, pack, owner, online, isRestoring: !!owner && (pack ? false : (!online && offline.restoring) || !result.data || !!state.restoring) }
}

export async function scanOfflineProduct(code: string) {
  if (navigator.onLine) return catalogCoordinator.scan(code)
  const pack = offlinePackageSnapshot()
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z0-9-]{1,128}$/.test(normalized)) throw Object.assign(new Error('Invalid QR'), { code: 'BAD_REQUEST' })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (!pack || pack.id !== offlinePackageSnapshot()?.id) throw new Error('Offline catalog unavailable')
  const id = offlineScanIndex(pack.data.products)[hash]
  const product = id ? pack.data.products[id] : undefined
  if (!product) throw Object.assign(new Error('Product unavailable'), { code: 'NOT_FOUND' })
  return product
}

export function useCatalogIds(ids: string[]) {
  const { state, owner, online, isRestoring } = useCatalogData()
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
