import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { queryClient } from '@/lib/query-client'
import { OfflineSnapshotSchema, type OfflineManifest } from '@persianpart/contract'
import { offlineRecoveryEnabled, useNetworkReadSource } from './read-source'
import { api } from '@/lib/api-client'
import { authStore } from '@/modules/auth/auth-store'
import { downloadOfflineData, offlineImages, type OfflineProgress } from './_download-offline-data'
import { downloadOfflineImages, missingOfflineImages, verifyOfflineAssets } from './_download-offline-images'
import { offlineImageCache, offlineMediaKey, sharedOfflineImageCache, offlineMaxAge, readOfflineEntry, updateOfflineEntry, validOfflinePackage, type OfflineEntry, type OfflinePackage } from './offline-storage'

interface OfflineState {
  active?: OfflinePackage
  draft?: OfflinePackage
  progress?: OfflineProgress
  error?: string
  restoring?: boolean
  assetsReady?: boolean
  assetError?: boolean
  checkingAssets?: boolean
  missingImages?: number
}

type SavedChange = { kind: 'order' | 'supply'; id: string } | { kind: 'profile' }
const pendingChanges = new Map<string, SavedChange>()
const latestChanges = new Map<string, number>()
let changeSequence = 0

let state: OfflineState = { restoring: true }
let owner = authStore.getState().user?.id ?? ''
let scope: string | undefined
let revision = 0
let restoreRequest = 0
let job: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('persianpart-offline-package')
const changed = () => {
  channel?.postMessage('changed')
  try { localStorage.setItem('persianpart_offline_changed', crypto.randomUUID()) } catch { /* BroadcastChannel can still notify peers. */ }
}

function publish(next: OfflineState) {
  const previous = state.active
  state = next
  if (previous && previous.id !== next.active?.id) {
    queryClient.removeQueries({ queryKey: queryKeys.offline.package(previous.owner, previous.scopeKey, previous.id) })
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function discardMedia(pack: OfflinePackage | undefined) {
  return pack && window.caches?.delete(offlineImageCache(pack.id)).catch(() => {})
}

async function pruneSharedMedia() {
  if (!window.caches || !await caches.has(sharedOfflineImageCache)) return
  const entry = await readOfflineEntry()
  const kept = new Set([entry?.active, entry?.draft].flatMap(pack =>
    pack?.manifest?.media.map(item => offlineMediaKey(location.origin, item.hash)) ?? []))
  const cache = await caches.open(sharedOfflineImageCache)
  for (const request of await cache.keys()) {
    if (!kept.has(request.url)) await cache.delete(request)
  }
}

async function clearStored(includeActive: boolean, matches: (entry: OfflineEntry) => boolean) {
  let removed: OfflineEntry | undefined
  await updateOfflineEntry(current => {
    if (!current || !matches(current)) return current
    removed = current
    return { owner: current.owner, generation: crypto.randomUUID(), scopeKey: current.scopeKey, active: includeActive ? undefined : current.active }
  })
  await Promise.all([discardMedia(removed?.draft), includeActive && discardMedia(removed?.active)])
  if (removed) {
    changed()
    if (navigator.locks) void navigator.locks.request('persianpart-offline-package', () => pruneSharedMedia()).catch(() => {})
  }
}

async function restore() {
  const expected = revision
  const request = ++restoreRequest
  const current = await readOfflineEntry()
  if (revision !== expected || request !== restoreRequest) return
  clearTimeout(timer)
  if (!owner || !current || current.owner !== owner || (scope && current.scopeKey !== scope)) {
    publish({ ...state, active: undefined, draft: undefined, restoring: false })
    if (current && (current.active || current.draft)) {
      await clearStored(true, entry => entry.generation === current.generation && revision === expected)
    }
    return
  }
  const candidate = current.active
  const validData = candidate?.manifest
    ? state.active?.id === candidate.id || OfflineSnapshotSchema.safeParse(candidate.data).success
    : !!candidate?.data.products && !!candidate.data.profile && Array.isArray(candidate.data.activity)
  const active = validData && validOfflinePackage(candidate) && candidate.owner === owner &&
    candidate.scopeKey === current.scopeKey ? candidate : undefined
  const now = Date.now()
  const draft = current.draft && current.draft.accessUntil > now && current.draft.startedAt + offlineMaxAge > now ? current.draft : undefined
  const expires = Math.min(active ? Math.min(active.accessUntil, active.completedAt! + offlineMaxAge) : Infinity,
    draft ? Math.min(draft.accessUntil, draft.startedAt + offlineMaxAge) : Infinity)
  if (Number.isFinite(expires)) timer = setTimeout(() => void refresh(), Math.max(0, expires - now))
  const sameActive = state.active?.id === active?.id
  if (sameActive && active) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.offline.package(active.owner, active.scopeKey, active.id) })
  }
  publish({ ...state, active: sameActive ? state.active : active, draft, restoring: false, assetsReady: sameActive && state.assetsReady })
  if (active && !job) {
    try {
      const missingImages = (await missingOfflineImages(active)).length
      if (expected === revision && request === restoreRequest && state.active?.id === active.id) publish({ ...state, missingImages })
      await verifyOfflineAssets(active)
      if (expected === revision && request === restoreRequest && state.active?.id === active.id) publish({ ...state, assetsReady: true, assetError: false })
    } catch {
      if (expected === revision && request === restoreRequest && state.active?.id === active.id) {
        // Keep readable data when the browser has removed image or shell entries.
        publish({ ...state, assetsReady: false, assetError: true })
      }
    }
  }
  if (revision !== expected || request !== restoreRequest) return
  if (active !== current.active || draft !== current.draft) {
    if (current.draft && !draft) job?.abort()
    let removed = false
    await updateOfflineEntry(entry => {
      if (revision !== expected || entry?.generation !== current.generation || entry.active?.id !== current.active?.id ||
          entry.draft?.id !== current.draft?.id) return entry
      removed = true
      return { ...entry, active, draft }
    })
    if (removed) {
      await Promise.all([!active && discardMedia(current.active), !draft && discardMedia(current.draft)])
      changed()
    }
  }
}

async function refresh() {
  try { await restore() } catch {
    publish({ ...state, restoring: false, error: 'دسترسی به فضای ذخیره‌سازی ممکن نشد.' })
  }
}

function switchAccount() {
  const next = authStore.getState().user?.id ?? ''
  if (next === owner) return
  const previous = owner
  owner = next
  pendingChanges.clear()
  latestChanges.clear()
  changeSequence++
  scope = undefined
  revision++
  job?.abort()
  publish({ restoring: true })
  if (previous) void clearStored(true, entry => entry.owner === previous).catch(() => {}).finally(() => void refresh())
  else void refresh()
}

export function acceptOfflineScope(next: string) {
  if (scope === next) return
  if (scope !== undefined) {
    pendingChanges.clear()
    latestChanges.clear()
    changeSequence++
  }
  scope = next
  if ((state.active && state.active.scopeKey !== next) || (state.draft && state.draft.scopeKey !== next)) {
    revision++
    job?.abort()
    publish({})
  }
  const expectedOwner = owner
  void clearStored(true, entry => entry.owner === expectedOwner && !!entry.scopeKey && entry.scopeKey !== next)
    .catch(() => {}).finally(() => void refresh())
}

async function verifySession(expectedOwner: string, signal: AbortSignal) {
  const session = await api.auth.session(undefined, { signal }).catch(error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'FORBIDDEN') authStore.logout()
    throw error
  })
  if (!session.user) {
    authStore.logout()
    throw new Error('session')
  }
  if (String(session.user.id) !== expectedOwner || !session.catalogScopeKey || !session.offlineAccessUntil ||
      session.offlineAccessUntil <= Date.now()) throw new Error('session')
  authStore.acceptProfile(session.user)
  return { scopeKey: session.catalogScopeKey, accessUntil: session.offlineAccessUntil }
}

export async function inspectOfflineDownload(replace: boolean) {
  const expectedOwner = owner
  const manifest = await api.offline.manifest({ replace })
  if (!expectedOwner || owner !== expectedOwner || manifest.expiresAt <= Date.now()) throw new Error('session')
  const draft = state.draft?.manifest?.id === manifest.id ? state.draft : undefined
  const cache = await caches.has(sharedOfflineImageCache) ? await caches.open(sharedOfflineImageCache) : undefined
  const keys = new Set((await cache?.keys() ?? []).map(request => request.url))
  const allMissing = new Map(manifest.media.filter(item => !keys.has(offlineMediaKey(location.origin, item.hash)))
    .map(item => [item.hash, item]))
  const missing = [...allMissing.values()]
  const mediaBytes = missing.reduce((total, item) => total + item.bytes, 0)
  const transferBytes = (draft?.catalogDone ? 0 : Math.ceil(manifest.compressedBytes / 3) * 4) + mediaBytes
  const requiredBytes = (draft?.catalogDone ? 0 : manifest.dataBytes) + mediaBytes
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
  const available = estimate?.quota === undefined || estimate.usage === undefined ? undefined : Math.max(0, estimate.quota - estimate.usage)
  return { manifest, transferBytes, totalBytes: manifest.compressedBytes + manifest.media.reduce((total, item) => total + item.bytes, 0),
    shortfall: available === undefined ? undefined : Math.max(0, requiredBytes - available) }
}

async function receiveSnapshot(pack: OfflinePackage, manifest: OfflineManifest, signal: AbortSignal) {
  const { gzip } = await api.offline.snapshot({ id: manifest.id }, { signal })
  const compressed = Uint8Array.from(atob(gzip), byte => byte.charCodeAt(0))
  if (compressed.length !== manifest.compressedBytes) throw new Error('snapshot')
  const body = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', body)), byte => byte.toString(16).padStart(2, '0')).join('')
  if (body.byteLength !== manifest.dataBytes || hash !== manifest.dataHash) throw new Error('snapshot')
  signal.throwIfAborted()
  pack.data = OfflineSnapshotSchema.parse(JSON.parse(new TextDecoder().decode(body)))
  for (const [name, count] of Object.entries(manifest.counts)) {
    const section = pack.data[name as keyof OfflinePackage['data']]
    if (!section || Object.keys(section).length !== count) throw new Error('snapshot')
  }
  pack.images = offlineImages(pack.data)
  const expected = new Set(manifest.media.map(item => new URL(item.path, location.origin).href))
  if (expected.size !== pack.images.length || pack.images.some(url => !expected.has(url))) throw new Error('image')
  pack.catalogDone = true
}

export async function prepareOfflinePackage(manifest?: OfflineManifest) {
  if (!owner || job || !navigator.onLine || (offlineRecoveryEnabled && !manifest)) return
  if (!navigator.locks || !navigator.serviceWorker?.controller || !window.caches) {
    publish({ ...state, error: 'برای آماده‌سازی آفلاین، برنامه را در مرورگر سازگار دوباره باز کنید.' })
    return
  }
  const expectedOwner = owner
  if (manifest) void navigator.storage?.persist?.().catch(() => false)
  const controller = new AbortController()
  const { signal } = controller
  job = controller
  publish({ ...state, error: undefined, progress: { phase: 'checking' } })
  try {
    await navigator.locks.request('persianpart-offline-package', { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('busy')
      signal.throwIfAborted()
      const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
      if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota <= estimate.usage) {
        throw new DOMException('Storage full', 'QuotaExceededError')
      }
      const session = await verifySession(expectedOwner, signal)
      signal.throwIfAborted()
      if (manifest && (manifest.scopeKey !== session.scopeKey || manifest.expiresAt <= Date.now())) throw new Error('scope')
      scope = session.scopeKey
      if (state.active && state.active.scopeKey !== scope) publish({ ...state, active: undefined, assetsReady: false })
      await clearStored(true, entry => entry.owner !== expectedOwner || (!!entry.scopeKey && entry.scopeKey !== scope))
      const current = await readOfflineEntry()
      signal.throwIfAborted()
      const previous = current?.owner === expectedOwner && current.scopeKey === scope && validOfflinePackage(current.active) ? current.active : undefined
      publish({ ...state, active: previous })
      const pack: OfflinePackage = current?.owner === expectedOwner && current.draft?.scopeKey === scope && current.draft.manifest?.id === manifest?.id &&
        current.draft.accessUntil > Date.now() && current.draft.startedAt + offlineMaxAge > Date.now() ? current.draft : {
          id: crypto.randomUUID(), owner: expectedOwner, ...session, startedAt: Date.now(), manifest,
          data: { products: {}, dimensions: [], qr: {}, orders: {}, supplies: {}, plans: [], activity: [] },
          images: [], imageSizes: {}, reusedImages: 0,
        }
      const generation = crypto.randomUUID()
      await updateOfflineEntry(entry => {
        signal.throwIfAborted()
        if (entry?.generation !== current?.generation) throw new DOMException('Offline package changed', 'AbortError')
        return { owner: expectedOwner, scopeKey: session.scopeKey, generation, active: previous, draft: pack }
      })
      signal.throwIfAborted()
      if (current?.draft?.id !== pack.id) await discardMedia(current?.draft)
      if (current?.active?.id !== previous?.id) await discardMedia(current?.active)
      publish({ ...state, draft: pack })
      changed()
      let appliedSequence = changeSequence
      async function save(complete = false) {
        signal.throwIfAborted()
        await updateOfflineEntry(entry => {
          signal.throwIfAborted()
          if (entry?.generation !== generation || entry.owner !== expectedOwner || owner !== expectedOwner) {
            throw new DOMException('Offline package changed', 'AbortError')
          }
          if (complete && appliedSequence !== changeSequence) throw new Error('history')
          return complete ? { ...entry, active: pack, draft: undefined } : { ...entry, draft: pack }
        })
      }
      const report = (progress: OfflineProgress) => {
        if (!signal.aborted) publish({ ...state, progress })
      }
      if (manifest) {
        if (!pack.catalogDone) {
          report({ phase: 'catalog' })
          await receiveSnapshot(pack, manifest, signal)
          await save()
          report({ phase: 'catalog', done: Object.keys(pack.data.products).length, total: manifest.counts.products })
        }
      } else {
        await downloadOfflineData(pack, !!authStore.getState().user?.canUseProductQr, signal, save, report)
      }
      const qrCount = Object.keys(pack.data.qr).length
      report({ phase: 'qr', done: qrCount, total: qrCount })
      if (!pack.images.length) pack.images = offlineImages(pack.data)
      await save()
      await downloadOfflineImages(pack, previous, signal, save, report)
      report({ phase: 'verifying' })
      await verifyOfflineAssets(pack, !!manifest)
      const confirmed = await verifySession(expectedOwner, signal)
      if (confirmed.scopeKey !== pack.scopeKey) {
        acceptOfflineScope(confirmed.scopeKey)
        throw new Error('scope')
      }
      if (Date.now() >= Math.min(pack.startedAt + offlineMaxAge, confirmed.accessUntil)) throw new Error('expired')
      appliedSequence = changeSequence
      if (manifest) {
        do {
          appliedSequence = changeSequence
          for (const change of pendingChanges.values()) pack.data = applyChangedData(pack.data, await readChangedData(change, signal))
        } while (appliedSequence !== changeSequence)
        const images = offlineImages(pack.data)
        if (images.some(url => !pack.images.includes(url))) throw new Error('image')
      }
      pack.completedAt = Date.now()
      pack.accessUntil = confirmed.accessUntil
      await save(true)
      if (appliedSequence === changeSequence) pendingChanges.clear()
      if (!signal.aborted && owner === expectedOwner && scope === pack.scopeKey) {
        restoreRequest++
        publish({ active: pack, assetsReady: true })
        changed()
      }
      await discardMedia(previous)
      if (manifest) window.setTimeout(() => {
        void navigator.locks.request('persianpart-offline-package', () => pruneSharedMedia()).catch(() => {})
      }, 60_000)
    })
  } catch (error) {
    if (!signal.aborted) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'scope' && owner === expectedOwner) {
        try {
          const confirmed = await verifySession(expectedOwner, signal)
          if (confirmed.scopeKey !== scope) acceptOfflineScope(confirmed.scopeKey)
        } catch { /* The normal session check handles connection failures. */ }
      }
      const label = error instanceof DOMException && error.name === 'QuotaExceededError' ? 'فضای ذخیره‌سازی کافی نیست.'
        : message === 'busy' ? 'آماده‌سازی در پنجرهٔ دیگری در جریان است.'
        : message === 'worker' ? 'فایل‌های برنامه هنوز آماده نیستند. دوباره تلاش کنید.'
        : state.progress?.phase === 'images' ? 'دریافت بعضی تصاویر کامل نشد. ادامهٔ دانلود را بزنید.'
        : 'آماده‌سازی کامل نشد. اتصال و دسترسی حساب را بررسی کنید و دوباره تلاش کنید.'
      publish({ ...state, error: label })
    }
  } finally {
    job = undefined
    publish({ ...state, progress: undefined })
    changed()
    await refresh()
  }
}

export async function repairOfflinePackage() {
  const active = offlinePackageSnapshot()
  if (!active || job || !navigator.onLine || !navigator.locks) return
  const controller = new AbortController()
  const { signal } = controller
  job = controller
  publish({ ...state, error: undefined, progress: { phase: 'checking' } })
  try {
    await navigator.locks.request('persianpart-offline-package', { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('busy')
      const saved = await readOfflineEntry()
      if (saved?.active?.id !== active.id) throw new Error('changed')
      const session = await verifySession(active.owner, signal)
      if (session.scopeKey !== active.scopeKey) {
        acceptOfflineScope(session.scopeKey)
        throw new Error('scope')
      }
      signal.throwIfAborted()
      const missing = await missingOfflineImages(active, true)
      const pack = { ...active, images: missing, imageSizes: {}, reusedImages: 0 }
      await downloadOfflineImages(pack, undefined, signal, async () => {
        signal.throwIfAborted()
        const current = await readOfflineEntry()
        if (current?.active?.id !== active.id || current.generation !== saved.generation) throw new Error('changed')
      }, progress => {
        if (!signal.aborted) publish({ ...state, progress })
      })
      await verifyOfflineAssets(active, true)
      signal.throwIfAborted()
      changed()
    })
  } catch (error) {
    if (!signal.aborted) {
      const message = error instanceof Error && error.message === 'busy'
        ? 'آماده‌سازی در پنجرهٔ دیگری در جریان است.'
        : 'تکمیل فایل‌های آفلاین ممکن نشد. دوباره تلاش کنید.'
      publish({ ...state, error: message })
    }
  } finally {
    job = undefined
    publish({ ...state, progress: undefined })
    await refresh()
  }
}

export function pauseOfflinePackage() {
  job?.abort()
}

export async function removeOfflinePackage(includeActive: boolean) {
  revision++
  job?.abort()
  const expectedOwner = owner
  publish({ active: includeActive ? undefined : state.active })
  try {
    await clearStored(includeActive, entry => entry.owner === expectedOwner)
    await refresh()
  } catch {
    publish({ ...state, error: 'پاک کردن داده‌های آفلاین ممکن نشد.' })
  }
}

export async function updateSavedOfflineRecord(change: SavedChange) {
  const active = offlinePackageSnapshot()
  if (!owner || (!active && !job)) return
  const key = change.kind === 'profile' ? 'profile' : change.kind + ':' + change.id
  pendingChanges.set(key, change)
  const changeId = ++changeSequence
  latestChanges.set(key, changeId)
  if (!active) return
  const expectedRevision = revision
  let changedData: Awaited<ReturnType<typeof readChangedData>>
  try {
    changedData = await readChangedData(change)
  } catch (error) {
    if (owner === active.owner && revision === expectedRevision) {
      publish({ ...state, error: 'عملیات ثبت شد. تازه‌کردن نسخهٔ ذخیره‌شده ممکن نشد.' })
    }
    throw error
  }
  if (revision !== expectedRevision || owner !== active.owner || latestChanges.get(key) !== changeId) return
  await updateOfflineEntry(entry => {
    if (revision !== expectedRevision || latestChanges.get(key) !== changeId || !entry?.active || entry.owner !== active.owner || entry.active.id !== active.id ||
      (scope && entry.active.scopeKey !== scope)) return entry
    return { ...entry, active: { ...entry.active, data: applyChangedData(entry.active.data, changedData) } }
  })
  await queryClient.invalidateQueries({ queryKey: queryKeys.offline.package(active.owner, active.scopeKey, active.id) })
  changed()
}

async function readChangedData(change: SavedChange, signal?: AbortSignal) {
  if (change.kind === 'profile') {
    const raw = await api.user.profile(undefined, { signal })
    if (!raw) throw new Error('session')
    const profile = OfflineSnapshotSchema.shape.profile.parse({
      name: raw.fullName ?? '', storeName: raw.companyName ?? '', phone: raw.phone ?? '',
      documents: (raw.documents ?? []).map((document: Record<string, unknown>) => ({
        id: document.id == null ? undefined : String(document.id),
        documentType: document.documentType ?? undefined, title: document.title ?? undefined,
        status: document.status ?? undefined, rejectionReason: document.rejectionReason ?? undefined,
        uploadedAt: document.uploadedAt ?? undefined,
      })),
    })
    return { profile }
  }
  const { kind, id } = change
  let cursor: string | undefined
  for (;;) {
    const page = await api.activityFeed.list({ filter: kind, limit: 50, cursor }, { signal })
    const activity = page.items.find(item => item.kind === kind && String(item.id) === id)
    if (activity) {
      if (kind === 'order') return { activity, order: await api.order.getById({ id }, { signal }) }
      return { activity, supply: await api.supplyRequest.detail({ id: Number(id) }, { signal }) }
    }
    if (!page.hasMore || !page.nextCursor || page.nextCursor === cursor) throw new Error('history')
    cursor = page.nextCursor
  }
}

function applyChangedData(data: OfflinePackage['data'], change: Awaited<ReturnType<typeof readChangedData>>) {
  if (change.profile) return { ...data, profile: change.profile }
  const activity = change.activity
  if (!activity) return data
  const id = String(activity.id)
  return {
    ...data,
    activity: [...data.activity.filter(item => item.kind !== activity.kind || String(item.id) !== id), activity],
    orders: change.order ? { ...data.orders, [id]: change.order } : data.orders,
    supplies: change.supply ? { ...data.supplies, [id]: change.supply } : data.supplies,
  }
}

export async function checkOfflinePackage() {
  const active = offlinePackageSnapshot()
  if (!active || job) return refresh()
  const expected = revision
  publish({ ...state, assetsReady: false, checkingAssets: true })
  try {
    if (active.manifest) OfflineSnapshotSchema.parse(active.data)
    const missingImages = (await missingOfflineImages(active, true)).length
    if (expected !== revision || state.active?.id !== active.id) return
    if (missingImages) {
      publish({ ...state, assetsReady: false, assetError: true, missingImages, checkingAssets: false })
      return
    }
    await verifyOfflineAssets(active)
    if (expected === revision && state.active?.id === active.id) {
      publish({ ...state, assetsReady: true, assetError: false, missingImages: 0, checkingAssets: false })
    }
  } catch {
    if (expected === revision && state.active?.id === active.id) {
      publish({ ...state, assetsReady: false, assetError: true, checkingAssets: false })
    }
  }
}

export function useOfflinePackage() {
  return useSyncExternalStore(subscribe, () => state)
}

export async function readSavedOfflinePackage(generation = state.active?.id) {
  if (!generation) return null
  const expected = revision
  const entry = await readOfflineEntry()
  const pack = entry?.active
  if (!validOfflinePackage(pack) || revision !== expected || pack.owner !== owner ||
    pack.id !== generation || pack.id !== state.active?.id || (scope && scope !== pack.scopeKey)) return null
  return pack
}

export function useSavedOfflinePackage() {
  const { active, restoring } = useOfflinePackage()
  const networkRead = useNetworkReadSource()
  const query = useQuery({
    queryKey: queryKeys.offline.package(active?.owner ?? '', active?.scopeKey ?? '', active?.id ?? ''),
    queryFn: () => readSavedOfflinePackage(active?.id),
    networkMode: 'always',
    enabled: !networkRead && !!active,
    retry: false,
  })
  return {
    active: !networkRead && query.data?.id === active?.id ? query.data ?? undefined : undefined,
    restoring: restoring || (!networkRead && !!active && query.isPending),
  }
}

export const offlinePackageSnapshot = () => validOfflinePackage(state.active) ? state.active : undefined

window.addEventListener('persianpart:account-change', switchAccount)
window.addEventListener('offline', pauseOfflinePackage)
window.addEventListener('storage', event => { if (event.key === 'persianpart_offline_changed') void refresh() })
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh() })
navigator.serviceWorker?.addEventListener('controllerchange', () => void refresh())
if (channel) channel.onmessage = () => void refresh()
void refresh()

navigator.serviceWorker?.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_MEDIA_MISSING' && state.assetsReady) void refresh()
})
