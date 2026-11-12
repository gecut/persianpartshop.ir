import type { QueryClient } from '@tanstack/react-query'
import type { CatalogRecord, CatalogBrowseInput } from '@persianpart/contract'
import { queryKeys } from '@/lib/query-keys'

interface CatalogPage { items: CatalogRecord[]; scopeKey: string; nextCursor: string | null }
interface CatalogResult { items: CatalogRecord[]; scopeKey: string }
interface Transport {
  syncPage(input: { cursor?: string; limit: number }, signal: AbortSignal): Promise<CatalogPage>
  getByIds(ids: number[], signal: AbortSignal): Promise<CatalogResult>
  scan(code: string, signal: AbortSignal): Promise<CatalogRecord>
  browse(input: CatalogBrowseInput, signal: AbortSignal): Promise<CatalogResult & { total: number; hasMore: boolean }>
}
export interface CatalogSnapshot {
  byId: Record<string, CatalogRecord>
  versions: Record<string, number>
  scanIndex: Record<string, string>
  scopeKey: string | null
  complete: boolean
  completedAt: number
  fetching: boolean
  error: Error | null
  restoring?: boolean
  restoredAt?: number
}
export const emptyCatalog: CatalogSnapshot = { byId: {}, versions: {}, scanIndex: {}, scopeKey: null, complete: false, completedAt: 0, fetching: false, error: null }
export const catalogMaxAge = 48 * 60 * 60 * 1000
export interface CatalogPersistence {
  open(owner: string): {
    restore(): Promise<CatalogSnapshot | undefined>
    save(): Promise<void>
  }
  invalidate(owner: string): void
}
const aborted = () => new DOMException('Catalog session changed', 'AbortError')
const retryable = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return false
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  return !code || ['SERVICE_UNAVAILABLE', 'INTERNAL_SERVER_ERROR', 'BAD_GATEWAY', 'GATEWAY_TIMEOUT'].includes(String(code))
}

/** Owns network work, not a second product store. All records live in Query Cache. */
export function createCatalogCoordinator(client: QueryClient, transport: Transport, available: (initial: boolean) => boolean, yieldToUI: () => Promise<void>, persistence?: CatalogPersistence) {
  let owner = '', epoch = 0, sequence = 0, foreground = 0, started = false
  let run: Promise<void> | null = null
  let cursor: string | undefined
  let seen = new Set<string>(), sweepStart = 0
  let storage: ReturnType<CatalogPersistence['open']> | undefined
  let restoring: Promise<void> | undefined
  let checkpointed = false
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  const controllers = new Set<AbortController>()
  const pendingIds = new Map<string, Promise<void>>()
  const pendingScans = new Map<string, Promise<CatalogRecord>>()
  const key = () => queryKeys.products.catalog(owner)
  const snapshot = () => client.getQueryData<CatalogSnapshot>(key()) ?? emptyCatalog
  const publish = (update: (state: CatalogSnapshot) => CatalogSnapshot) => client.setQueryData<CatalogSnapshot>(key(), state => update(state ?? emptyCatalog))
  function resetDependentQueries() {
    void client.resetQueries({ queryKey: queryKeys.products.browses(owner) })
    void client.invalidateQueries({ queryKey: queryKeys.products.facets(owner) })
  }
  function reset(nextOwner: string) {
    clearTimeout(expiryTimer)
    epoch++; controllers.forEach(controller => controller.abort()); controllers.clear()
    if (owner !== nextOwner) client.removeQueries({ queryKey: key(), exact: true })
    owner = nextOwner; started = false; run = null; cursor = undefined; sweepStart = 0; seen = new Set(); targeted.clear(); pendingIds.clear(); pendingScans.clear()
    storage = undefined; restoring = undefined; checkpointed = false
    publish(() => ({ ...emptyCatalog }))
  }
  function openStorage(restore: boolean) {
    if (!persistence || !owner) return
    storage = persistence.open(owner)
    if (!restore) return
    const expected = epoch
    publish(state => ({ ...state, restoring: true }))
    restoring = storage.restore().then(saved => {
      if (!saved || expected !== epoch) return
      const scopeKey = snapshot().scopeKey
      if (scopeKey && scopeKey !== saved.scopeKey) {
        const wasStarted = started
        changeScope(scopeKey)
        started = wasStarted
        void pump()
        return
      }
      checkpointed = true
      publish(() => saved)
      if (saved.restoredAt !== undefined) {
        expiryTimer = setTimeout(() => {
          if (epoch !== expected || !snapshot().restoredAt) return
          const wasStarted = started
          const scope = snapshot().scopeKey
          reset(owner)
          openStorage(false)
          publish(state => ({ ...state, scopeKey: scope }))
          resetDependentQueries()
          started = wasStarted
          void pump()
        }, Math.max(0, saved.restoredAt + catalogMaxAge - Date.now()))
      }
    }).catch(() => {}).finally(() => {
      if (expected !== epoch) return
      restoring = undefined
      if (snapshot().restoring) publish(state => ({ ...state, restoring: false }))
      void pump()
    })
  }
  function changeScope(scopeKey: string) {
    persistence?.invalidate(owner)
    reset(owner)
    openStorage(false)
    publish(state => ({ ...state, scopeKey }))
    resetDependentQueries()
  }
  function merge(items: CatalogRecord[], scopeKey: string | null, read: number) {
    const previous = snapshot()
    if (scopeKey && previous.scopeKey && previous.scopeKey !== scopeKey) {
      changeScope(scopeKey)
      started = true
      queueMicrotask(() => void pump())
      throw aborted()
    }
    publish(state => {
      const byId = { ...state.byId }, versions = { ...state.versions }
      for (const item of items) if ((versions[String(item.id)] ?? -1) <= read) { byId[String(item.id)] = item; versions[String(item.id)] = read }
      const scanIndex: Record<string, string> = {}
      for (const item of Object.values(byId)) if (item.scanHash) scanIndex[item.scanHash] = String(item.id)
      return { ...state, byId, versions, scanIndex, scopeKey: scopeKey ?? state.scopeKey }
    })
  }
  async function request<T>(fn: (signal: AbortSignal) => Promise<T>, retry = true): Promise<T> {
    const expected = epoch, controller = new AbortController()
    controllers.add(controller)
    try {
      let result: T
      try { result = await fn(controller.signal) }
      catch (error) {
        if (!retry || !retryable(error) || expected !== epoch || controller.signal.aborted) throw error
        await yieldToUI()
        result = await fn(controller.signal)
      }
      if (expected !== epoch || controller.signal.aborted) throw aborted()
      return result
    } finally { controllers.delete(controller) }
  }
  function pump(force = false): Promise<void> {
    if (run) return run
    if (restoring) return restoring
    if (!owner || !available(!snapshot().completedAt && !cursor) || foreground || !started) return Promise.resolve()
    if (snapshot().complete && !sweepStart) {
      if (!force && Date.now() - snapshot().completedAt < 120_000) return Promise.resolve()
      cursor = undefined; seen = new Set(); targeted.clear(); sweepStart = ++sequence
    } else if (!sweepStart) sweepStart = ++sequence
    const expected = epoch
    const work = async () => {
      if (expected !== epoch) return
      if (foreground || !available(!snapshot().completedAt && !cursor)) { run = null; return }
      publish(state => ({ ...state, fetching: true, error: null }))
      try {
        do {
          const read = ++sequence
          const page = await request(signal => transport.syncPage({ cursor, limit: !cursor && !snapshot().completedAt ? 24 : 100 }, signal))
          merge(page.items, page.scopeKey, read)
          page.items.forEach(item => seen.add(String(item.id)))
          cursor = page.nextCursor ?? undefined
          if (!page.nextCursor) {
            publish(state => {
              const byId = Object.fromEntries(Object.entries(state.byId).filter(([id]) => seen.has(id) || (state.versions[id] ?? 0) > sweepStart && !seen.has(id)))
              // Only targeted reads newer than the sweep may survive absence.
              for (const id of Object.keys(byId)) if (!seen.has(id) && !targeted.has(id)) delete byId[id]
              const scanIndex: Record<string, string> = {}
              const versions = { ...state.versions }
              for (const id of Object.keys(state.byId)) if (!byId[id]) versions[id] = Math.max(versions[id] ?? 0, sweepStart)
              for (const item of Object.values(byId)) if (item.scanHash) scanIndex[item.scanHash] = String(item.id)
              return { ...state, byId, versions, scanIndex, complete: true, completedAt: Date.now(), restoredAt: undefined }
            })
            clearTimeout(expiryTimer)
            checkpointed = true
            void storage?.save().catch(() => {})
            sweepStart = 0; targeted.clear(); break
          }
          if (!checkpointed) {
            checkpointed = true
            void storage?.save().catch(() => {})
          }
          await yieldToUI()
        } while (expected === epoch && available(false) && !foreground)
      } catch (error) {
        if (expected === epoch) publish(state => ({ ...state, error: error instanceof Error ? error : new Error("دریافت کاتالوگ ممکن نشد.") }))
      } finally {
        if (expected === epoch) { publish(state => ({ ...state, fetching: false })); run = null }
      }
    }
    // Defer starting so StrictMode and simultaneous consumers share the same promise.
    run = Promise.resolve().then(work)
    return run
  }
  const targeted = new Set<string>()
  async function ensureIds(ids: string[], force = false): Promise<void> {
    const missing = [...new Set(ids)].filter(id => /^[1-9]\d*$/.test(id) && (force || !snapshot().byId[id]))
    const waiting = missing.flatMap(id => pendingIds.has(id) ? [pendingIds.get(id)!] : [])
    const fresh = missing.filter(id => !pendingIds.has(id))
    if (fresh.length) {
      const expected = epoch
      foreground++
      const work = (async () => {
        try {
          for (let offset = 0; offset < fresh.length; offset += 100) {
            const batch = fresh.slice(offset, offset + 100), read = ++sequence
            const result = await request(signal => transport.getByIds(batch.map(Number), signal))
            merge(result.items, result.scopeKey, read)
            result.items.forEach(item => targeted.add(String(item.id)))
            const found = new Set(result.items.map(item => String(item.id)))
            publish(state => {
              const byId = { ...state.byId }, versions = { ...state.versions }
              for (const id of batch) if (!found.has(id) && (state.versions[id] ?? 0) <= read) { delete byId[id]; versions[id] = read }
              const scanIndex = Object.fromEntries(Object.entries(state.scanIndex).filter(([, id]) => !!byId[id]))
              return { ...state, byId, versions, scanIndex }
            })
          }
        } finally { foreground--; if (expected === epoch) fresh.forEach(id => pendingIds.delete(id)); if (started && !snapshot().error) void pump() }
      })()
      fresh.forEach(id => pendingIds.set(id, work)); waiting.push(work)
    }
    await Promise.all(waiting)
  }
  return {
    setOwner(nextOwner: string) {
      if (nextOwner === owner && (!owner || client.getQueryData(key()))) return restoring
      if (owner) persistence?.invalidate(owner)
      reset(nextOwner)
      openStorage(true)
      return restoring
    },
    reset() {
      if (owner) persistence?.invalidate(owner)
      reset('')
    },
    discardStored(ownerToDiscard: string) {
      if (ownerToDiscard !== owner) return
      const wasStarted = started
      reset(owner)
      openStorage(false)
      resetDependentQueries()
      if (wasStarted) { started = true; void pump() }
    },
    snapshot,
    acceptScope(scopeKey: string) {
      if (!snapshot().scopeKey) { publish(state => ({ ...state, scopeKey })); return }
      if (snapshot().scopeKey === scopeKey) return
      const wasStarted = started
      changeScope(scopeKey)
      if (wasStarted) { started = true; void pump() }
    },
    start() { started = true; return pump() },
    resume() { if (started) return pump(); return Promise.resolve() },
    refresh() { started = true; return pump(true) },
    ensureIds,
    async scan(code: string) {
      const expected = epoch
      const normalized = code.trim().toUpperCase()
      if (!/^[A-Z0-9-]{1,128}$/.test(normalized)) throw new Error('کد محصول معتبر نیست.')
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (expected !== epoch) throw aborted()
      const id = snapshot().scanIndex[hash]
      if (id && snapshot().byId[id]) return snapshot().byId[id]!
      const existing = pendingScans.get(normalized)
      if (existing) return existing
      const read = ++sequence; foreground++
      const work = request(signal => transport.scan(normalized, signal)).then(item => { merge([item], null, read); targeted.add(String(item.id)); return item }).finally(() => { foreground--; if (expected === epoch) pendingScans.delete(normalized); void pump() })
      pendingScans.set(normalized, work)
      return work
    },
    async browse(input: CatalogBrowseInput, signal: AbortSignal) {
      const expected = epoch, read = ++sequence; foreground++
      try {
        const result = await transport.browse(input, signal)
        if (expected !== epoch || signal.aborted) throw aborted()
        merge(result.items, result.scopeKey, read)
        result.items.forEach(item => targeted.add(String(item.id)))
        return { ids: result.items.map(item => String(item.id)), total: result.total, hasMore: result.hasMore }
      } finally { foreground--; void pump() }
    },
  }
}
