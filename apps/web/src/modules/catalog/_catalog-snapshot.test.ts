import { describe, expect, test } from 'bun:test'
import type { CatalogRecord } from '@persianpart/contract'
import { emptyCatalog, type CatalogSnapshot } from './catalog-coordinator'
import { buildScanIndex, dropMissing, finishSweep, mergeRecords } from './_catalog-snapshot'

const record = (id: number, scanHash?: string) => ({ id, scanHash }) as unknown as CatalogRecord
const state = (records: CatalogRecord[], versions: Record<string, number>): CatalogSnapshot => {
  const byId = Object.fromEntries(records.map(item => [String(item.id), item]))
  return { ...emptyCatalog, byId, versions, scanIndex: buildScanIndex(byId) }
}

describe('catalog snapshot transforms', () => {
  test('merge keeps a newer read and indexes scan hashes', () => {
    const before = state([record(1, 'old')], { '1': 5 })
    const stale = mergeRecords(before, [record(1, 'stale')], null, 4)
    expect(stale.byId['1']).toBe(before.byId['1'])
    const next = mergeRecords(before, [record(1, 'new'), record(2)], 'scope', 6)
    expect(next.versions).toEqual({ '1': 6, '2': 6 })
    expect(next.scanIndex).toEqual({ new: '1' })
    expect(next.scopeKey).toBe('scope')
  })

  test('finishing a sweep drops unseen records unless a newer targeted read kept them', () => {
    const before = state([record(1), record(2), record(3), record(4, 'h4')], { '1': 3, '2': 3, '3': 9, '4': 9 })
    const next = finishSweep(before, new Set(['1']), new Set(['3']), 5, 1234)
    expect(Object.keys(next.byId).sort()).toEqual(['1', '3'])
    expect(next.versions).toEqual({ '1': 3, '2': 5, '3': 9, '4': 9 })
    expect(next.scanIndex).toEqual({})
    expect(next).toMatchObject({ complete: true, completedAt: 1234, restoredAt: undefined })
  })

  test('dropMissing removes requested ids that were not found and are not newer', () => {
    const before = state([record(1, 'h1'), record(2, 'h2')], { '1': 2, '2': 8 })
    const next = dropMissing(before, ['1', '2'], new Set(), 5)
    expect(Object.keys(next.byId)).toEqual(['2'])
    expect(next.versions).toEqual({ '1': 5, '2': 8 })
    expect(next.scanIndex).toEqual({ h2: '2' })
  })
})
