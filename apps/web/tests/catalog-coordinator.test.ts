import { describe, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { createCatalogCoordinator } from '../src/modules/products/catalog-coordinator'
import type { CatalogRecord } from '@persianpart/contract'

const product = (id: number, price = 100): CatalogRecord => ({ id, sku: `P${id}`, name: `Product ${id}`, slug: `p${id}`, createdAt: new Date(2026, 0, id).toISOString(), inventorySqm: 100, stockCartons: 100, availability: 'available', finalCustomerPricePerSqm: price, hasScanCode: false })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function fixture() {
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
  const coordinator = createCatalogCoordinator(client, transport, () => visible, async () => { await Promise.resolve() })
  coordinator.setOwner('one')
  return { coordinator, transport, calls, setVisible(value: boolean) { visible = value }, setPages(value: CatalogRecord[][]) { pages = value }, idsCalls: () => idsCalls, scans: () => scans }
}

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
