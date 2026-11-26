import { useEffect, useMemo } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { CatalogRecordSchema, type CatalogRecord } from '@persianpart/contract'
import { parseQrToken } from './qr-token'
import { api, hasForegroundRequests } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { writeActivity } from '@/lib/write-activity'
import { authStore, useAuth } from '@/modules/auth/auth-store'
import { createCatalogCoordinator, emptyCatalog, type CatalogSnapshot } from './catalog-coordinator'
import { mapCatalogProduct } from './catalog-mapper'
import { createCatalogPersistence } from './_catalog-persistence'
import { offlinePackageSnapshot, readSavedOfflinePackage, useSavedOfflinePackage } from '@/modules/pwa/offline-package'
import { offlineRecoveryEnabled, readsFromNetwork, useNetworkReadSource } from '@/modules/pwa/read-source'

const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const persistence = offlineRecoveryEnabled ? undefined : createCatalogPersistence(queryClient, owner => catalogCoordinator.discardStored(owner))
export const catalogCoordinator = createCatalogCoordinator(queryClient, {
  syncPage: (input, signal) => api.catalog.syncPage(input, { signal }),
  getByIds: (ids, signal) => api.catalog.getByIds({ ids }, { signal }),
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
  const online = useNetworkReadSource()
  const result = useQuery<CatalogSnapshot>({
    queryKey: queryKeys.products.catalog(owner),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  useEffect(() => {
    catalogCoordinator.setOwner(owner)
    if (owner) {
      if (start && !offlineRecoveryEnabled) void catalogCoordinator.start()
      else void catalogCoordinator.resume()
    }
  }, [owner, start])
  const offline = useSavedOfflinePackage()
  const pack = !online && offline.active?.owner === owner ? offline.active : undefined
  const state = useMemo(() => {
    if (!pack) return online || !offlineRecoveryEnabled ? result.data ?? emptyCatalog : emptyCatalog
    return { ...emptyCatalog, byId: pack.data.products, scopeKey: pack.scopeKey, complete: true, completedAt: pack.completedAt ?? 0 }
  }, [pack, result.data, online])
  return { state, pack, owner, online, isRestoring: !!owner && (online ? !result.data || !!state.restoring : !!offline.restoring) }
}

export async function scanOfflineProduct(raw: string): Promise<CatalogRecord> {
  const token = parseQrToken(raw)
  if (!token) throw Object.assign(new Error('Invalid QR'), { code: 'BAD_REQUEST' })
  if (readsFromNetwork()) return CatalogRecordSchema.parse(await api.catalog.getByQrToken({ token }))
  const pack = await readSavedOfflinePackage()
  if (!pack || pack.id !== offlinePackageSnapshot()?.id) throw new Error('Offline catalog unavailable')
  const id = pack.data.qr[token]
  const product = id === undefined ? undefined : pack.data.products[String(id)]
  if (!product) throw Object.assign(new Error('Product unavailable'), { code: 'NOT_FOUND' })
  return product
}

export function useCatalogIds(ids: string[]) {
  const { state, owner, online, isRestoring } = useCatalogData()
  const signature = [...new Set(ids)].sort().join(',')
  const query = useQuery({
    queryKey: queryKeys.products.byIds(owner, state.scopeKey, signature),
    queryFn: async () => {
      await catalogCoordinator.ensureIds(signature.split(','))
      return signature
    },
    enabled: !!owner && !!signature && online && !isRestoring,
    retry: false,
  })
  const data = useMemo(() => signature
    ? ids.flatMap(id => state.byId[id] ? [mapCatalogProduct(state.byId[id]!)] : [])
    : [], [state.byId, ids, signature])
  const missing = data.length < ids.length
  const offlineMissing = missing && !online && !isRestoring
  const failure = online ? query.error : null
  const error = failure ?? (offlineMissing ? new Error('برای دیدن این کالا به اینترنت وصل شوید.') :
    missing && online && query.isSuccess ? new Error('یکی از محصولات در دسترس حساب شما نیست.') : null)
  return { data, raw: state.byId, error, offlineMissing,
    isPending: missing && online && !isRestoring && query.isPending,
    isFetching: missing && online && query.isFetching,
    refetch: async () => {
      if (online && navigator.onLine && !isRestoring && signature) {
        try { await catalogCoordinator.ensureIds(signature.split(','), true); await query.refetch() }
        catch { await query.refetch() }
      }
    },
  }
}

export function useCatalogProduct(id: string | number | null | undefined) {
  const result = useCatalogIds(id ? [String(id)] : [])
  return { ...result, data: result.data[0] ?? null, isError: !!result.error }
}
