import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSave, type PersistedClient, type Persister } from '@tanstack/query-persist-client-core'
import { createStore, get, update } from 'idb-keyval'
import { CatalogBrowseOutputSchema, CatalogRecordSchema } from '@persianpart/contract'
import { queryKeys } from '@/lib/query-keys'
import { catalogMaxAge, emptyCatalog, type CatalogPersistence, type CatalogSnapshot, type SavedBrowsePage } from './catalog-coordinator'

const buster = 'catalog-v1'
const browseVersion = 1
interface StoredCatalog {
  generation: number
  client?: PersistedClient
  browse?: SavedBrowsePage & { version: number }
}

export function createCatalogPersistence(client: QueryClient, onDiscard: (owner: string) => void): CatalogPersistence {
  let store: ReturnType<typeof createStore> | undefined
  const db = () => store ??= createStore('persianpart-offline', 'catalog')
  const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('persianpart-catalog')
  if (channel) channel.onmessage = ({ data }) => { if (typeof data === 'string') onDiscard(data) }

  return {
    open(owner) {
      const key = queryKeys.products.catalog(owner)
      const keyMatches = (candidate: readonly unknown[]) => candidate.length === key.length && key.every((part, i) => candidate[i] === part)
      let initial: Promise<StoredCatalog | undefined> | undefined =
        Promise.resolve().then(() => get<StoredCatalog>(owner, db())).catch(() => undefined)
      const generationAtOpen = initial.then(entry => entry?.generation ?? 0)
      // Each handle can write only while its IndexedDB generation still owns the record.
      async function write(next?: PersistedClient) {
        const generation = await generationAtOpen
        if (next) initial = undefined
        await update<StoredCatalog | undefined>(owner, current => {
          if ((current?.generation ?? 0) !== generation) return current
          if (next && (current?.client?.timestamp ?? 0) > next.timestamp) return current
          const previousData = current?.client?.clientState?.queries?.[0]?.state?.data as CatalogSnapshot | undefined
          const nextData = next?.clientState.queries[0]?.state.data as CatalogSnapshot | undefined
          if (previousData?.complete && nextData && !nextData.complete &&
            Date.now() - (current?.client?.timestamp ?? 0) < catalogMaxAge) return current
          return { ...current, generation, client: next }
        }, db())
      }
      const persister: Persister = {
        async persistClient(saved) {
          const query = saved.clientState.queries[0]
          const data = query?.state.data as CatalogSnapshot | undefined
          if (!query || !data?.scopeKey) return
          await write({
            ...saved,
            timestamp: query.state.dataUpdatedAt,
            clientState: {
              mutations: [],
              queries: [{
                ...query,
                state: { ...query.state, data: {
                  ...emptyCatalog,
                  byId: data.byId,
                  scopeKey: data.scopeKey,
                  complete: data.complete,
                  completedAt: data.completedAt,
                } },
              }],
            },
          })
        },
        async restoreClient() {
          const saved = (await initial)?.client
          if (!saved) return
          const query = saved.clientState.queries[0]
          const data = query?.state.data as CatalogSnapshot | undefined
          if (saved.clientState.queries.length !== 1 || saved.clientState.mutations.length || !query || !keyMatches(query.queryKey) ||
            typeof data?.scopeKey !== 'string' || typeof data.complete !== 'boolean' || !Number.isFinite(data.completedAt) ||
            !data.byId || typeof data.byId !== 'object' || Array.isArray(data.byId) ||
            !Number.isFinite(saved.timestamp) || saved.timestamp > Date.now() || Date.now() - saved.timestamp >= catalogMaxAge) {
            throw new Error('Invalid offline catalog')
          }
          const scanIndex: Record<string, string> = {}
          for (const [id, record] of Object.entries(data.byId)) {
            const parsed = CatalogRecordSchema.safeParse(record)
            if (!parsed.success || String(parsed.data.id) !== id) throw new Error('Invalid offline product')
            if (parsed.data.scanHash) scanIndex[parsed.data.scanHash] = id
          }
          return { ...saved, clientState: { mutations: [], queries: [{
            ...query,
            state: { ...query.state, data: { ...emptyCatalog, byId: data.byId, scopeKey: data.scopeKey, complete: data.complete, completedAt: data.completedAt, scanIndex, restoredAt: saved.timestamp } },
          }] } }
        },
        // Restore may reject an old record while a different tab is writing a fresh one.
        async removeClient() {
          const entry = await initial
          if (!entry?.client) return
          await update<StoredCatalog | undefined>(owner, current =>
            current?.generation === entry.generation && current?.client?.timestamp === entry.client?.timestamp
              ? { ...current, client: undefined } : current, db())
        },
      }
      return {
        async restore() {
          // Stage hydration so a late restore cannot publish into a different account.
          const staged = new QueryClient({ defaultOptions: { queries: { gcTime: catalogMaxAge } } })
          try {
            await persistQueryClientRestore({ queryClient: staged, persister, buster, maxAge: catalogMaxAge })
            return staged.getQueryData<CatalogSnapshot>(key)
          } finally {
            staged.clear()
            initial = undefined
          }
        },
        async restoreBrowse() {
          const saved = (await initial)?.browse
          if (saved?.version !== browseVersion || !Number.isFinite(saved.savedAt) ||
            saved.savedAt > Date.now() || Date.now() - saved.savedAt >= catalogMaxAge) return
          const parsed = CatalogBrowseOutputSchema.safeParse(saved.response)
          if (parsed.success && parsed.data.scopeKey) return { response: parsed.data, savedAt: saved.savedAt }
        },
        async saveBrowse(page) {
          const generation = await generationAtOpen
          await update<StoredCatalog | undefined>(owner, current => {
            if ((current?.generation ?? 0) !== generation || (current?.browse?.savedAt ?? 0) > page.savedAt) return current
            return { ...current, generation, browse: { ...page, version: browseVersion } }
          }, db())
        },
        save: () => persistQueryClientSave({
          queryClient: client, persister, buster,
          dehydrateOptions: {
            shouldDehydrateQuery: query => keyMatches(query.queryKey) && query.state.status === 'success',
            shouldDehydrateMutation: () => false,
          },
        }),
      }
    },
    invalidate(owner) {
      void Promise.resolve().then(() => update<StoredCatalog>(owner, current => ({
        generation: (current?.generation ?? 0) + 1,
      }), db())).catch(() => {}).finally(() => channel?.postMessage(owner))
    },
  }
}
