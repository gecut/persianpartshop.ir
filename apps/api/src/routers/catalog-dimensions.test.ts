import { beforeEach, expect, mock, test } from 'bun:test'
import { call } from '@orpc/server'

const dimensions = [
  { id: 1, name: 'A', width: 10, height: 10, slug: 'a', isActive: true, createdAt: 'created', updatedAt: 'updated', extra: 'preserved' },
  { id: 2, name: 'B', width: 20, height: 20, slug: 'b', isActive: true, createdAt: 'created', updatedAt: 'updated' },
  { id: 3, name: 'C', width: 30, height: 30, slug: 'c', isActive: true, createdAt: 'created', updatedAt: 'updated' },
]
let allowedCategories: number[] = []
let pages: number[] = []
let failProducts = false
const products = [
  { dimension: 1, category: 1, isActive: true },
  { dimension: 2, category: 1, isActive: true },
  { dimension: 2, category: 2, isActive: true },
  { dimension: 1, category: 2, isActive: false },
]
mock.module('../payload', () => ({ sdk: {
  findByID: async () => ({ allowedCategories }),
  find: async ({ collection, where, page }: { collection: string; where: { category?: { in: number[] } }; page?: number }) => {
    if (collection === 'dimensions') return { docs: dimensions.slice() }
    if (failProducts) throw new Error('CMS unavailable')
    pages.push(page!)
    const visible = products.filter(product => product.isActive && (!where.category || where.category.in.includes(product.category)))
    const offset = (page! - 1) * 2
    return { docs: visible.slice(offset, offset + 2), hasNextPage: offset + 2 < visible.length }
  },
} }))
const { catalog } = await import('./catalog')
const context = { user: { id: 1, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') }

beforeEach(() => { allowedCategories = []; pages = []; failProducts = false })

test('sorts active product counts across pages and retains zero-count dimensions', async () => {
  const result = await call(catalog.dimensions, { onlyActive: true }, { context })
  expect(result.map((dimension: { id: number }) => dimension.id)).toEqual([2, 1, 3])
  expect(result[1]).toEqual(dimensions[0])
  expect(pages).toEqual([1, 2])
})

test('uses permitted categories and preserves width order for equal counts', async () => {
  allowedCategories = [1]
  const result = await call(catalog.dimensions, { onlyActive: true }, { context })
  expect(result.map((dimension: { id: number }) => dimension.id)).toEqual([1, 2, 3])
})

test('does not return a misleading order when product lookup fails', async () => {
  failProducts = true
  await expect(call(catalog.dimensions, { onlyActive: true }, { context })).rejects.toThrow()
})
