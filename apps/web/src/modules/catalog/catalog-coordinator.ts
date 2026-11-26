import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { CatalogRecord, CatalogBrowseInput, CatalogBrowseOutput } from '@persianpart/contract'
import { queryKeys } from '@/lib/query-keys'
import { defaultBrowseKey, firstBrowsePage, isDefaultBrowse } from './catalog-browse'
import { dropMissing, finishSweep, mergeRecords } from './_catalog-snapshot'

interface CatalogPage { items: CatalogRecord[]; scopeKey: string; nextCursor: string | null }
interface CatalogResult { items: CatalogRecord[]; scopeKey: string }
interface Transport {
  syncPage(input: { cursor?: string; limit: number }, signal: AbortSignal): Promise<CatalogPage>
  getByIds(ids: number[], signal: AbortSignal): Promise<CatalogResult>
  browse(input: CatalogBrowseInput, signal: AbortSignal): Promise<CatalogBrowseOutput>
}
export interface CatalogSnapshot {
  byId: Record<string, CatalogRecord>
  versions: Record<string, number>
  scopeKey: string | null
  complete: boolean
  completedAt: number
  fetching: boolean
  error: Error | null
  restoring?: boolean
  restoredAt?: number
}
export const emptyCatalog: CatalogSnapshot = { byId: {}, versions: {}, scopeKey: null, complete: false, completedAt: 0, fetching: false, error: null }
export const catalogMaxAge = 48 * 60 * 60 * 1000
export interface SavedBrowsePage {
  response: CatalogBrowseOutput
  savedAt: number
}
export interface CatalogPersistence {
  open(owner: string): {
    restore(): Promise<CatalogSnapshot | undefined>
    save(): Promise<void>
    restoreBrowse(): Promise<SavedBrowsePage | undefined>
    saveBrowse(page: SavedBrowsePage): Promise<void>
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
  let browseExpiryTimer: ReturnType<typeof setTimeout> | undefined
  const controllers = new Set<AbortController>()
  const pendingIds = new Map<string, Promise<void>>()
  const key = () => queryKeys.products.catalog(owner)
  const snapshot = () => client.getQueryData<CatalogSnapshot>(key()) ?? emptyCatalog
  const publish = (update: (state: CatalogSnapshot) => CatalogSnapshot) => client.setQueryData<CatalogSnapshot>(key(), state => update(state ?? emptyCatalog))
  function resetDependentQueries() {
    void client.resetQueries({ queryKey: queryKeys.products.browses(owner) })
    void client.invalidateQueries({ queryKey: queryKeys.products.facets(owner) })
  }
  function expireBrowseAt(savedAt: number) {
    clearTimeout(browseExpiryTimer)
    const queryKey = defaultBrowseKey(owner)
    browseExpiryTimer = setTimeout(() => {
      void client.resetQueries({ queryKey, exact: true })
    }, Math.max(0, savedAt + catalogMaxAge - Date.now()))
  }
  function reset(nextOwner: string, catalogExpired = false) {
    clearTimeout(expiryTimer)
    if (!catalogExpired) clearTimeout(browseExpiryTimer)
    epoch++; controllers.forEach(controller => controller.abort()); controllers.clear()
    if (owner !== nextOwner) {
      client.removeQueries({ queryKey: key(), exact: true })
      client.removeQueries({ queryKey: queryKeys.products.browses(owner) })
    }
    owner = nextOwner; started = false; run = null; cursor = undefined; sweepStart = 0; seen = new Set(); targeted.clear(); pendingIds.clear()
    storage = undefined; restoring = undefined; checkpointed = false
    publish(() => ({ ...emptyCatalog }))
  }
  function openStorage(restore: boolean) {
    if (!persistence || !owner) return
    storage = persistence.open(owner)
    if (!restore) return
    const expected = epoch
    publish(state => ({ ...state, restoring: true }))
    restoring = Promise.all([
      storage.restore().catch(() => undefined),
      storage.restoreBrowse().catch(() => undefined),
    ]).then(([saved, browse]) => {
      if (expected !== epoch) return
      const scopeKey = snapshot().scopeKey
      if (scopeKey && (saved && scopeKey !== saved.scopeKey || browse && scopeKey !== browse.response.scopeKey)) {
        const wasStarted = started
        changeScope(scopeKey)
        started = wasStarted
        void pump()
        return
      }
      if (saved) {
        checkpointed = true
        publish(() => saved)
      }
      if (browse && (!saved || saved.scopeKey === browse.response.scopeKey) && Date.now() - browse.savedAt < catalogMaxAge) {
        const queryKey = defaultBrowseKey(owner)
        if (!snapshot().scopeKey) publish(state => ({ ...state, scopeKey: browse.response.scopeKey }))
        client.getQueryCache().build(client, { queryKey, gcTime: catalogMaxAge })
        client.setQueryData<InfiniteData<CatalogBrowseOutput, number>>(queryKey, {
          pages: [browse.response], pageParams: [firstBrowsePage],
        }, { updatedAt: browse.savedAt })
        void client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' })
        expireBrowseAt(browse.savedAt)
      }
      if (saved?.restoredAt !== undefined) {
        expiryTimer = setTimeout(() => {
          if (epoch !== expected || !snapshot().restoredAt) return
          const wasStarted = started
          const scope = snapshot().scopeKey
          reset(owner, true)
          openStorage(false)
          publish(state => ({ ...state, scopeKey: scope }))
          void client.invalidateQueries({ queryKey: queryKeys.products.facets(owner) })
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
    publish(state => mergeRecords(state, items, scopeKey, read))
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
            // Only targeted reads newer than the sweep may survive absence.
            publish(state => finishSweep(state, seen, targeted, sweepStart, Date.now()))
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
            publish(state => dropMissing(state, batch, found, read))
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
    async browse(requestOwner: string, input: CatalogBrowseInput, signal: AbortSignal) {
      if (!requestOwner || requestOwner !== owner || signal.aborted) throw aborted()
      const expected = epoch, read = ++sequence; foreground++
      try {
        const result = await transport.browse(input, signal)
        if (expected !== epoch || signal.aborted) throw aborted()
        merge(result.items, result.scopeKey, read)
        result.items.forEach(item => targeted.add(String(item.id)))
        const { page, ...filters } = input
        if (page === firstBrowsePage && isDefaultBrowse(filters)) {
          const savedAt = Date.now()
          expireBrowseAt(savedAt)
          void storage?.saveBrowse({ response: result, savedAt }).catch(() => {})
        }
        return result
      } finally { foreground--; void pump() }
    },
  }
}
