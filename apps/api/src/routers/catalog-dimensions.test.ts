import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { Mock } from 'bun:test'
import { sdk } from '../lib/payload'
import { facetDimensions } from './catalog'

type FindOptions = { collection: string; page?: number; where?: Record<string, unknown> }
type FindResult = { docs: Record<string, unknown>[]; hasNextPage?: boolean }

const dimensions = [
  { id: 1, name: '60×120' }, { id: 2, name: '80×80' },
  { id: 3, name: '40×40' }, { id: 4, name: '30x30' }, { id: 5, name: '20×20' },
]
const productPages: FindResult[] = [
  { docs: [{ dimension: 1 }, { dimension: 2 }], hasNextPage: true },
  { docs: [{ dimension: { id: 3 } }, { dimension: 4 }, { dimension: 3 }], hasNextPage: false },
]

describe('facetDimensions', () => {
  let find: Mock<(options: FindOptions) => Promise<FindResult>>
  const productQueries: FindOptions[] = []

  beforeEach(() => {
    productQueries.length = 0
    // The SDK's generic signature cannot be satisfied by a hand-written fake.
    find = spyOn(sdk, 'find') as unknown as typeof find
    find.mockImplementation(async (options) => {
      if (options.collection === 'dimensions') return { docs: dimensions }
      productQueries.push(options)
      return productPages[(options.page ?? 1) - 1]!
    })
  })
  afterEach(() => { find.mockRestore() })

  test('keeps dimensions used by an accessible tile, across every page, most used first', async () => {
    const result = await facetDimensions([9])

    expect(result.map((dimension) => dimension.id)).toEqual([3, 1, 2, 4])
    expect(productQueries.map((query) => query.page)).toEqual([1, 2])
  })

  test('scopes the count to the given categories and excludes other products in the query', async () => {
    await facetDimensions([9])

    expect(productQueries[0]?.where).toEqual({
      isActive: { equals: true },
      dimension: { in: [1, 2, 3, 4, 5] },
      category: { in: [9] },
      or: [{ productType: { not_equals: 'other' } }, { productType: { exists: false } }],
    })
  })

  test('does not restrict categories when the scope allows all of them', async () => {
    await facetDimensions([])

    expect(productQueries[0]?.where).not.toHaveProperty('category')
  })
})
