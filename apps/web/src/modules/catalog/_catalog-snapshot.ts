import type { CatalogRecord } from '@persianpart/contract'
import type { CatalogSnapshot } from './catalog-coordinator'

// Pure snapshot transforms used by the catalog coordinator.

export function buildScanIndex(byId: Record<string, CatalogRecord>): Record<string, string> {
  const scanIndex: Record<string, string> = {}
  for (const item of Object.values(byId)) if (item.scanHash) scanIndex[item.scanHash] = String(item.id)
  return scanIndex
}

/** Applies records read at `read` unless a newer read already wrote the same id. */
export function mergeRecords(state: CatalogSnapshot, items: readonly CatalogRecord[], scopeKey: string | null, read: number): CatalogSnapshot {
  const byId = { ...state.byId }, versions = { ...state.versions }
  for (const item of items) if ((versions[String(item.id)] ?? -1) <= read) { byId[String(item.id)] = item; versions[String(item.id)] = read }
  return { ...state, byId, versions, scanIndex: buildScanIndex(byId), scopeKey: scopeKey ?? state.scopeKey }
}

/**
 * Completes a full sync sweep: records absent from the sweep are dropped unless a targeted
 * read newer than the sweep start found them, and dropped ids are tombstoned at `sweepStart`.
 */
export function finishSweep(state: CatalogSnapshot, seen: ReadonlySet<string>, targeted: ReadonlySet<string>, sweepStart: number, completedAt: number): CatalogSnapshot {
  const byId = Object.fromEntries(Object.entries(state.byId).filter(([id]) => seen.has(id) || (state.versions[id] ?? 0) > sweepStart && !seen.has(id)))
  for (const id of Object.keys(byId)) if (!seen.has(id) && !targeted.has(id)) delete byId[id]
  const versions = { ...state.versions }
  for (const id of Object.keys(state.byId)) if (!byId[id]) versions[id] = Math.max(versions[id] ?? 0, sweepStart)
  return { ...state, byId, versions, scanIndex: buildScanIndex(byId), complete: true, completedAt, restoredAt: undefined }
}

/** Removes requested ids the server no longer returns, unless a newer read wrote them. */
export function dropMissing(state: CatalogSnapshot, requested: readonly string[], found: ReadonlySet<string>, read: number): CatalogSnapshot {
  const byId = { ...state.byId }, versions = { ...state.versions }
  for (const id of requested) if (!found.has(id) && (state.versions[id] ?? 0) <= read) { delete byId[id]; versions[id] = read }
  const scanIndex = Object.fromEntries(Object.entries(state.scanIndex).filter(([, id]) => !!byId[id]))
  return { ...state, byId, versions, scanIndex }
}
