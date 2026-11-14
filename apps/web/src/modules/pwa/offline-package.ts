import { useSyncExternalStore } from 'react'
import { api } from '@/lib/api-client'
import { authStore } from '@/modules/auth/auth-store'
import { downloadOfflineData, offlineImages, type OfflineProgress } from './_download-offline-data'
import { downloadOfflineImages, verifyOfflineAssets } from './_download-offline-images'
import { offlineImageCache, offlineMaxAge, readOfflineEntry, updateOfflineEntry, validOfflinePackage, type OfflineEntry, type OfflinePackage } from './offline-storage'

interface OfflineState {
  active?: OfflinePackage
  draft?: OfflinePackage
  progress?: OfflineProgress
  error?: string
  restoring?: boolean
  assetsReady?: boolean
  assetError?: boolean
}

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
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function discardMedia(pack: OfflinePackage | undefined) {
  return pack && window.caches?.delete(offlineImageCache(pack.id)).catch(() => {})
}

async function clearStored(includeActive: boolean, matches: (entry: OfflineEntry) => boolean) {
  let removed: OfflineEntry | undefined
  await updateOfflineEntry(current => {
    if (!current || !matches(current)) return current
    removed = current
    return { owner: current.owner, generation: crypto.randomUUID(), scopeKey: current.scopeKey, active: includeActive ? undefined : current.active }
  })
  await Promise.all([discardMedia(removed?.draft), includeActive && discardMedia(removed?.active)])
  if (removed) changed()
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
  const active = validOfflinePackage(current.active) ? current.active : undefined
  const now = Date.now()
  const draft = current.draft && current.draft.accessUntil > now && current.draft.startedAt + offlineMaxAge > now ? current.draft : undefined
  const expires = Math.min(active ? Math.min(active.accessUntil, active.completedAt! + offlineMaxAge) : Infinity,
    draft ? Math.min(draft.accessUntil, draft.startedAt + offlineMaxAge) : Infinity)
  if (Number.isFinite(expires)) timer = setTimeout(() => void refresh(), Math.max(0, expires - now))
  const sameActive = state.active?.id === active?.id
  publish({ ...state, active: sameActive ? state.active : active, draft, restoring: false, assetsReady: sameActive && state.assetsReady })
  if (active && !job) {
    try {
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
  scope = undefined
  revision++
  job?.abort()
  publish({ restoring: true })
  if (previous) void clearStored(true, entry => entry.owner === previous).catch(() => {}).finally(() => void refresh())
  else void refresh()
}

export function acceptOfflineScope(next: string) {
  if (scope === next) return
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

export async function prepareOfflinePackage() {
  if (!owner || job || !navigator.onLine) return
  if (!navigator.locks || !navigator.serviceWorker?.controller || !window.caches) {
    publish({ ...state, error: 'برای آماده‌سازی آفلاین، برنامه را در مرورگر سازگار دوباره باز کنید.' })
    return
  }
  const expectedOwner = owner
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
      scope = session.scopeKey
      if (state.active && state.active.scopeKey !== scope) publish({ ...state, active: undefined, assetsReady: false })
      await clearStored(true, entry => entry.owner !== expectedOwner || (!!entry.scopeKey && entry.scopeKey !== scope))
      const current = await readOfflineEntry()
      signal.throwIfAborted()
      const previous = current?.owner === expectedOwner && current.scopeKey === scope && validOfflinePackage(current.active) ? current.active : undefined
      publish({ ...state, active: previous })
      const pack: OfflinePackage = current?.owner === expectedOwner && current.draft?.scopeKey === scope &&
        current.draft.accessUntil > Date.now() && current.draft.startedAt + offlineMaxAge > Date.now() ? current.draft : {
          id: crypto.randomUUID(), owner: expectedOwner, ...session, startedAt: Date.now(),
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
      async function save(complete = false) {
        signal.throwIfAborted()
        await updateOfflineEntry(entry => {
          signal.throwIfAborted()
          if (entry?.generation !== generation || entry.owner !== expectedOwner || owner !== expectedOwner) {
            throw new DOMException('Offline package changed', 'AbortError')
          }
          return complete ? { ...entry, active: pack, draft: undefined } : { ...entry, draft: pack }
        })
      }
      const report = (progress: OfflineProgress) => {
        if (!signal.aborted) publish({ ...state, progress })
      }
      await downloadOfflineData(pack, !!authStore.getState().user?.canUseProductQr, signal, save, report)
      const qrCount = Object.keys(pack.data.qr).length
      report({ phase: 'qr', done: qrCount, total: qrCount })
      if (!pack.images.length) pack.images = offlineImages(pack.data)
      await save()
      await downloadOfflineImages(pack, previous, signal, save, report)
      report({ phase: 'verifying' })
      await verifyOfflineAssets(pack)
      const confirmed = await verifySession(expectedOwner, signal)
      if (confirmed.scopeKey !== pack.scopeKey) {
        acceptOfflineScope(confirmed.scopeKey)
        throw new Error('scope')
      }
      if (Date.now() >= Math.min(pack.startedAt + offlineMaxAge, confirmed.accessUntil)) throw new Error('expired')
      pack.completedAt = Date.now()
      pack.accessUntil = confirmed.accessUntil
      await save(true)
      if (!signal.aborted && owner === expectedOwner && scope === pack.scopeKey) {
        restoreRequest++
        publish({ active: pack, assetsReady: true })
        changed()
      }
      await discardMedia(previous)
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

export function useOfflinePackage() {
  return useSyncExternalStore(subscribe, () => state)
}

export const offlinePackageSnapshot = () => validOfflinePackage(state.active) ? state.active : undefined

window.addEventListener('persianpart:account-change', switchAccount)
window.addEventListener('offline', pauseOfflinePackage)
window.addEventListener('storage', event => { if (event.key === 'persianpart_offline_changed') void refresh() })
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh() })
navigator.serviceWorker?.addEventListener('controllerchange', () => void refresh())
if (channel) channel.onmessage = () => void refresh()
void refresh()
