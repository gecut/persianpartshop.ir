import { createStore, get } from 'idb-keyval'
import type { OfflineManifest, ActivityFeedItem, CatalogRecord, CustomerOrderDocumentSchema, Dimension, PlanDto, SupplyRequest } from '@persianpart/contract'
import type { CustomerDocument } from '@/modules/account/profile-view/_document-types'

export const offlineMaxAge = 7 * 24 * 60 * 60 * 1000
export const sharedOfflineImageCache = 'persianpart-offline-media-content-v1'
export const offlineImagePrefix = 'persianpart-offline-media-v1-'
const offlineStore = createStore('persianpart-offline-package-v1', 'packages')
const offlineKey = 'current'
const mediaKey = 'active-media'

export interface OfflineProfile {
  name: string
  storeName: string
  phone: string
  documents: CustomerDocument[]
}

export interface OfflineData {
  products: Record<string, CatalogRecord>
  dimensions: Dimension[]
  qr: Record<string, string>
  activity: ActivityFeedItem[]
  orders: Record<string, ReturnType<typeof CustomerOrderDocumentSchema.parse>>
  supplies: Record<string, SupplyRequest>
  plans: PlanDto[]
  profile?: OfflineProfile
}

export interface OfflinePackage {
  id: string
  owner: string
  scopeKey: string
  accessUntil: number
  startedAt: number
  manifest?: OfflineManifest
  completedAt?: number
  data: OfflineData
  images: string[]
  imageSizes: Record<string, number>
  reusedImages: number
  cursor?: string
  catalogDone?: boolean
  activityDone?: boolean
  plansDone?: boolean
}

export interface OfflineEntry {
  owner: string
  scopeKey?: string
  generation: string
  active?: OfflinePackage
  draft?: OfflinePackage
}

export function validOfflinePackage(pack: OfflinePackage | undefined, now = Date.now()): pack is OfflinePackage {
  return !!pack?.completedAt && pack.completedAt <= now && now < Math.min(pack.accessUntil, pack.completedAt + offlineMaxAge)
}

export function readOfflineEntry() {
  return get<OfflineEntry>(offlineKey, offlineStore)
}

export function readOfflineMedia() {
  return get<Pick<OfflinePackage, 'id' | 'accessUntil' | 'completedAt' | 'imageSizes'> & { imageKeys?: Record<string, string> }>(mediaKey, offlineStore)
}

export function updateOfflineEntry(updater: (current: OfflineEntry | undefined) => OfflineEntry | undefined) {
  return offlineStore('readwrite', store => new Promise<void>((resolve, reject) => {
    const transaction = store.transaction
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    const request = store.get(offlineKey)
    request.onsuccess = () => {
      try {
        const current: OfflineEntry | undefined = request.result
        const next = updater(current)
        if (current === next) return
        store.put(next, offlineKey)
        if (current?.active?.id === next?.active?.id) return
        const active = next?.active
        if (!active) store.delete(mediaKey)
        else store.put({
          id: active.id, accessUntil: active.accessUntil, completedAt: active.completedAt, imageSizes: active.imageSizes,
          imageKeys: active.manifest && Object.fromEntries(active.manifest.media.map(item => [item.path, item.hash])),
        }, mediaKey)
      } catch (error) {
        reject(error)
        transaction.abort()
      }
    }
  }))
}

export function offlineImageCache(id: string) {
  return offlineImagePrefix + id
}

export function publicImageUrl(raw: string, origin: string, cdn: string) {
  try {
    const url = new URL(raw, origin)
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return
    if (!(url.origin === cdn || (url.origin === origin && url.pathname.startsWith('/api/media/file/')))) return
    if (!/\.(?:jpe?g|png|webp|avif|gif)$/i.test(url.pathname)) return
    url.hash = ''
    return url.href
  } catch {
    return
  }
}

export function offlineMediaKey(origin: string, hash: string) {
  return new URL('/offline-media/' + hash, origin).href
}
