import { describe, expect, test } from 'bun:test'
import { InfiniteQueryObserver, QueryClient, type InfiniteData } from '@tanstack/react-query'
import { catalogMaxAge, createCatalogCoordinator, emptyCatalog, type CatalogPersistence, type CatalogSnapshot, type SavedBrowsePage } from '../src/modules/products/catalog-coordinator'
import { defaultBrowseFilters, defaultBrowseKey, firstBrowsePage } from '../src/modules/products/_catalog-browse'
import type { CatalogBrowseOutput, CatalogRecord } from '@persianpart/contract'

const product = (id: number, price = 100): CatalogRecord => ({ id, sku: `P${id}`, name: `Product ${id}`, slug: `p${id}`, createdAt: new Date(2026, 0, id).toISOString(), inventorySqm: 100, stockCartons: 100, availability: 'available', finalCustomerPricePerSqm: price, hasScanCode: false })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function fixture(persistence?: CatalogPersistence) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  let visible = true
  let pages = [[product(1)], [product(2)]]
  const calls: Array<{ cursor?: string; limit: number }> = []
  let idsCalls = 0, scans = 0
  const transport = {
    async syncPage(input: { cursor?: string; limit: number }, _signal: AbortSignal) {
      calls.push(input)
      const page = Number(input.cursor ?? 0)
      return { items: pages[page] ?? [], scopeKey: 'scope', nextCursor: page + 1 < pages.length ? String(page + 1) : null }
    },
    async getByIds(ids: number[], _signal: AbortSignal) { idsCalls++; return { items: ids.map(id => product(id, 200)), scopeKey: 'scope' } },
    async scan(_code: string, _signal: AbortSignal) { scans++; return product(3) },
    async browse() { return { items: [product(4)], scopeKey: 'scope', total: 1, hasMore: false } },
  }
  const coordinator = createCatalogCoordinator(client, transport, () => visible, async () => { await Promise.resolve() }, persistence)
  coordinator.setOwner('one')
  return { client, coordinator, transport, calls, setVisible(value: boolean) { visible = value }, setPages(value: CatalogRecord[][]) { pages = value }, idsCalls: () => idsCalls, scans: () => scans }
}

const browseStorage = { restoreBrowse: async () => undefined, saveBrowse: async () => {} }

describe('shared progressive catalog', () => {
  test('renders the first page before a delayed second page and shares a single sweep', async () => {
    const f = fixture(), second = deferred<Awaited<ReturnType<typeof f.transport.syncPage>>>()
    const original = f.transport.syncPage
    f.transport.syncPage = async (input, signal) => input.cursor ? second.promise : original(input, signal)
    const run = f.coordinator.start()
    expect(f.coordinator.start()).toBe(run)
    await Bun.sleep(0)
    expect(Object.keys(f.coordinator.snapshot().byId)).toEqual(['1'])
    expect(f.coordinator.snapshot().complete).toBe(false)
    expect(f.calls[0]?.limit).toBe(24)
    second.resolve({ items: [product(2)], scopeKey: 'scope', nextCursor: null })
    await run
    expect(f.coordinator.snapshot().complete).toBe(true)
    await f.coordinator.start()
    expect(f.calls.length).toBe(1)
  })
  test('pauses between pages when hidden and resumes from the cursor', async () => {
    const f = fixture(), original = f.transport.syncPage
    f.transport.syncPage = async (input, signal) => { const result = await original(input, signal); if (!input.cursor) f.setVisible(false); return result }
    await f.coordinator.start()
    expect(f.calls.length).toBe(1)
    expect(f.coordinator.snapshot().complete).toBe(false)
    f.setVisible(true)
    await f.coordinator.resume()
    expect(f.calls.map(call => call.cursor)).toEqual([undefined, '1'])
    expect(f.calls[1]?.limit).toBe(100)
    expect(f.coordinator.snapshot().complete).toBe(true)
  })
  test('failure retries once, preserves records and resumes without restarting page one', async () => {
    const f = fixture(), original = f.transport.syncPage
    let failures = 0
    f.transport.syncPage = async (input, signal) => { if (input.cursor) { failures++; throw new Error('network') }; return original(input, signal) }
    await f.coordinator.start()
    expect(failures).toBe(2)
    expect(f.coordinator.snapshot().byId['1']).toBeDefined()
    expect(f.coordinator.snapshot().complete).toBe(false)
    f.transport.syncPage = original
    await f.coordinator.resume()
    expect(f.calls.map(call => call.cursor)).toEqual([undefined, '1'])
    expect(f.coordinator.snapshot().complete).toBe(true)
  })
  test('targeted misses deduplicate; present products require no network', async () => {
    const f = fixture()
    await Promise.all([f.coordinator.ensureIds(['7']), f.coordinator.ensureIds(['7'])])
    expect(f.idsCalls()).toBe(1)
    await f.coordinator.ensureIds(['7'])
    expect(f.idsCalls()).toBe(1)
  })
  test('a slow background response cannot overwrite a newer targeted read', async () => {
    const f = fixture(), page = deferred<Awaited<ReturnType<typeof f.transport.syncPage>>>()
    f.transport.syncPage = () => page.promise
    const run = f.coordinator.start()
    await Bun.sleep(0)
    await f.coordinator.ensureIds(['1'], true)
    page.resolve({ items: [product(1, 100)], scopeKey: 'scope', nextCursor: null })
    await run
    expect(f.coordinator.snapshot().byId['1']?.finalCustomerPricePerSqm).toBe(200)
  })
  test('account changes reject late responses', async () => {
    const f = fixture(), page = deferred<Awaited<ReturnType<typeof f.transport.syncPage>>>()
    f.transport.syncPage = () => page.promise
    const run = f.coordinator.start()
    await Bun.sleep(0)
    f.coordinator.setOwner('two')
    page.resolve({ items: [product(1)], scopeKey: 'scope', nextCursor: null })
    await run
    expect(Object.keys(f.coordinator.snapshot().byId)).toHaveLength(0)
  })
  test('a queued bootstrap is discarded when the account changes before it starts', async () => {
    const f = fixture()
    const run = f.coordinator.start()
    f.coordinator.setOwner('two')
    await run
    expect(f.calls).toHaveLength(0)
    expect(Object.keys(f.coordinator.snapshot().byId)).toHaveLength(0)
  })
  test('a paused refresh resumes without restarting page one or deleting unseen old records', async () => {
    const f = fixture()
    await f.coordinator.start()
    f.setPages([[product(1, 300)], [product(3)]])
    const original = f.transport.syncPage
    f.transport.syncPage = async (input, signal) => { const result = await original(input, signal); if (!input.cursor) f.setVisible(false); return result }
    await f.coordinator.refresh()
    expect(f.coordinator.snapshot().byId['2']).toBeDefined()
    f.setVisible(true)
    await f.coordinator.resume()
    expect(f.calls.map(call => call.cursor)).toEqual([undefined, '1', undefined, '1'])
    expect(f.coordinator.snapshot().byId['2']).toBeUndefined()
    expect(f.coordinator.snapshot().byId['3']).toBeDefined()
  })
  test('refresh keeps old data until completion, then removes absent products', async () => {
    const f = fixture()
    await f.coordinator.start()
    f.setPages([[product(1, 300)]])
    const run = f.coordinator.refresh()
    expect(f.coordinator.snapshot().byId['2']).toBeDefined()
    await run
    expect(f.coordinator.snapshot().byId['2']).toBeUndefined()
    expect(f.coordinator.snapshot().byId['1']?.finalCustomerPricePerSqm).toBe(300)
  })
  test('QR matches a local hash without a lookup; unknown codes hydrate the shared cache', async () => {
    const f = fixture()
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('PP-001'))
    const scanHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    f.setPages([[{ ...product(1), scanHash }]])
    await f.coordinator.start()
    expect((await f.coordinator.scan(' pp-001 ')).id).toBe(1)
    expect(f.scans()).toBe(0)
    expect((await f.coordinator.scan('PP-NEW')).id).toBe(3)
    expect(f.coordinator.snapshot().byId['3']).toBeDefined()
  })
})

describe('catalog checkpoints', () => {
  test('saves the first page and completed sweeps, preserving the previous full version during refresh', async () => {
    const saved: Array<[boolean, string[]]> = []
    const f = fixture({
      open: () => ({
        ...browseStorage,
        restore: async () => undefined,
        save: async () => {
          const snapshot = f.coordinator.snapshot()
          saved.push([snapshot.complete, Object.keys(snapshot.byId)])
        },
      }),
      invalidate() {},
    })
    await f.coordinator.setOwner('one')
    await f.coordinator.start()
    expect(saved).toEqual([[false, ['1']], [true, ['1', '2']]])
    f.setPages([[product(1)], [product(3)]])
    await f.coordinator.refresh()
    expect(saved).toEqual([[false, ['1']], [true, ['1', '2']], [true, ['1', '3']]])
  })

  test('defers network startup and ignores an old account restore after a switch', async () => {
    const pending = deferred<CatalogSnapshot>(), invalidated: string[] = []
    const f = fixture({
      open: owner => ({ ...browseStorage, restore: async () => owner === 'one' ? pending.promise : undefined, save: async () => {} }),
      invalidate: owner => { invalidated.push(owner) },
    })
    const started = f.coordinator.start()
    expect(f.coordinator.snapshot().restoring).toBe(true)
    expect(f.calls).toHaveLength(0)
    await f.coordinator.setOwner('two')
    pending.resolve({ ...emptyCatalog, byId: { '99': product(99) }, scopeKey: 'old' })
    await started
    expect(invalidated).toEqual(['one'])
    expect(f.coordinator.snapshot().byId['99']).toBeUndefined()
  })

  test('invalidates disk data if a confirmed scope arrives before hydration', async () => {
    const pending = deferred<CatalogSnapshot>(), invalidated: string[] = []
    const f = fixture({
      open: () => ({ ...browseStorage, restore: async () => pending.promise, save: async () => {} }),
      invalidate: owner => { invalidated.push(owner) },
    })
    const restore = f.coordinator.setOwner('one')
    f.coordinator.acceptScope('new')
    pending.resolve({ ...emptyCatalog, byId: { '99': product(99) }, scopeKey: 'old' })
    await restore
    expect(invalidated).toEqual(['one'])
    expect(f.coordinator.snapshot().scopeKey).toBe('new')
    expect(f.coordinator.snapshot().byId['99']).toBeUndefined()
  })
})

describe('saved default browse page', () => {
  const queryKey = defaultBrowseKey('one')
  const input = { ...defaultBrowseFilters, page: firstBrowsePage }
  const response = { scopeKey: 'scope', items: [product(1), product(3), product(2)], total: 30, hasMore: true }

  test('hydrates the exact page with its original timestamp and revalidates in place', async () => {
    const savedAt = Date.now() - 1000
    const saved: SavedBrowsePage[] = []
    const f = fixture({
      open: () => ({
        restore: async () => undefined,
        save: async () => {},
        restoreBrowse: async () => ({ response, savedAt }),
        saveBrowse: async (page) => { saved.push(page) },
      }),
      invalidate() {},
    })
    await f.coordinator.setOwner('one')
    expect(f.client.getQueryState(queryKey)?.dataUpdatedAt).toBe(savedAt)

    const pending = deferred<CatalogBrowseOutput>()
    f.transport.browse = () => pending.promise
    const observer = new InfiniteQueryObserver(f.client, {
      queryKey,
      queryFn: ({ signal }) => f.coordinator.browse('one', input, signal),
      initialPageParam: firstBrowsePage,
      getNextPageParam: () => undefined,
      staleTime: 120_000,
    })
    const unsubscribe = observer.subscribe(() => {})
    const fetch = observer.refetch({ cancelRefetch: false })
    try {
      const before = observer.getCurrentResult()
      expect(before.isFetching).toBe(true)
      expect(before.data?.pages).toEqual([response])
      pending.resolve(response)
      expect((await fetch).data?.pages).toEqual([response])
      expect(saved.map(page => page.response)).toEqual([response])

      const updated = { ...response, items: [product(1, 200), product(3), product(2)] }
      f.transport.browse = async () => updated
      expect((await observer.refetch()).data?.pages).toEqual([updated])
      f.transport.browse = async () => { throw new Error('network') }
      expect((await observer.refetch()).data?.pages).toEqual([updated])
    } finally {
      unsubscribe()
      f.coordinator.reset()
    }
  })

  test('persists an empty default first page and skips other pages and filters', async () => {
    const saved: SavedBrowsePage[] = []
    const f = fixture({
      open: () => ({
        ...browseStorage,
        restore: async () => undefined,
        save: async () => {},
        saveBrowse: async page => { saved.push(page) },
      }),
      invalidate() {},
    })
    await f.coordinator.setOwner('one')
    const empty = { ...response, items: [], total: 0, hasMore: false }
    f.transport.browse = async () => empty
    const signal = new AbortController().signal
    try {
      await f.coordinator.browse('one', { ...input, page: 2 }, signal)
      await f.coordinator.browse('one', { ...input, sort: 'newest' }, signal)
      await f.coordinator.browse('one', { ...input, search: 'tile' }, signal)
      expect(saved).toHaveLength(0)
      expect(await f.coordinator.browse('one', input, signal)).toEqual(empty)
      expect(saved.map(page => page.response)).toEqual([empty])
    } finally {
      f.coordinator.reset()
    }
  })

  test('ignores expired pages and rejects late responses after scope or account changes', async () => {
    const saved: SavedBrowsePage[] = []
    const f = fixture({
      open: () => ({
        restore: async () => undefined,
        save: async () => {},
        restoreBrowse: async () => ({ response, savedAt: Date.now() - catalogMaxAge }),
        saveBrowse: async page => { saved.push(page) },
      }),
      invalidate() {},
    })
    await f.coordinator.setOwner('one')
    expect(f.client.getQueryData<InfiniteData<CatalogBrowseOutput>>(queryKey)).toBeUndefined()

    const signal = new AbortController().signal
    const oldScope = deferred<CatalogBrowseOutput>()
    f.coordinator.acceptScope('scope')
    f.transport.browse = () => oldScope.promise
    const scopedRequest = f.coordinator.browse('one', input, signal)
    f.coordinator.acceptScope('new')
    oldScope.resolve(response)
    await expect(scopedRequest).rejects.toHaveProperty('name', 'AbortError')

    const oldAccount = deferred<CatalogBrowseOutput>()
    f.transport.browse = () => oldAccount.promise
    const accountRequest = f.coordinator.browse('one', input, signal)
    await f.coordinator.setOwner('two')
    oldAccount.resolve({ ...response, scopeKey: 'new' })
    await expect(accountRequest).rejects.toHaveProperty('name', 'AbortError')
    expect(saved).toHaveLength(0)
    f.coordinator.reset()
  })
})
