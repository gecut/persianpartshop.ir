import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { sdk } from '../lib/payload'
import type { Context } from '../rpc/context'
import { catalogDimensions } from './catalog'

const context = { user: { id: 1, role: 'customer' } } as Context

describe('catalog dimension facets', () => {
  afterEach(() => { spy.mockRestore() })
  const spy = spyOn(sdk, 'find')

  test('returns only dimensions with accessible matching products across pages', async () => {
    spy.mockImplementation(async (options: any) => {
      if (options.collection === 'dimensions') return { docs: [
        { id: 1, name: '60×120' }, { id: 2, name: '80×80' },
        { id: 3, name: '40×40' }, { id: 4, name: '30x30' },
      ] } as any
      expect(options.where.isActive).toEqual({ equals: true })
      expect(options.where.category).toEqual({ in: [9] })
      return (options.page === 1
        ? { docs: [{ dimension: 1 }, { dimension: 2, productType: 'other' }], hasNextPage: true }
        : { docs: [{ dimension: { id: 3 } }, { dimension: 4 }], hasNextPage: false }) as any
    })
    const result = await catalogDimensions({ onlyActive: true }, context, [9])
    expect(result.map(d => d.id)).toEqual([1, 3])
  })
})
