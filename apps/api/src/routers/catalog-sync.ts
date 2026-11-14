import { createHash } from 'node:crypto'
import { z } from 'zod'
import { CatalogRecordSchema, CatalogSyncCursorSchema } from '@persianpart/contract'
import type { CatalogRecord } from '@persianpart/contract'
import type { Product, ProductsSelect } from '@persianpart/cms/types'
import type { Context } from '../rpc/context'
import { authed } from '../rpc/base'
import { sdk } from '../payload'
import { ORPCError } from '@orpc/server'
import { applyProductPricing, getUserPermissions } from './router.helpers'
import { attachWarehouseStock } from './warehouse-stock.helpers'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export async function catalogScope(context: Context) {
  const permissions = await getUserPermissions(context.user?.id, context)
  const scopeKey = hash(JSON.stringify([context.user?.id ?? '', context.user?.role ?? '', [...permissions.allowedCategoryIds].sort((a,b) => a-b), permissions.markupPercent, permissions.hideExactStock, permissions.disableOrdering, permissions.canUseProductQr]))
  return { permissions, scopeKey }
}
type Scope = Awaited<ReturnType<typeof catalogScope>>
const productProjection = {
  name: true, sku: true, slug: true, isActive: true, productType: true,
  category: true, brand: true, color: true, grade: true, tags: true, dimension: true,
  width: true, height: true, basePricePerSqm: true, sqmPerCarton: true, piecesPerCarton: true,
  cartonsPerPallet: true, unit: true, weight: true, secondary_unit: true, itemsPerPack: true,
  approxCoverage: true, cover: true, gallery: true, richDescription: true, scanCode: true, createdAt: true, updatedAt: true,
} satisfies ProductsSelect
export function catalogRecord(product: Product, context: Context, scope: Scope): CatalogRecord {
  const safe = applyProductPricing(product, scope.permissions.markupPercent, scope.permissions.hideExactStock)
  return CatalogRecordSchema.parse({ ...safe,
    createdAt: product.createdAt,
    scanHash: context.user?.role === 'customer' && scope.permissions.canUseProductQr && product.scanCode ? hash(product.scanCode.trim().toUpperCase()) : undefined,
  })
}
function allowedWhere(scope: Scope) {
  return { isActive: { equals: true }, ...(scope.permissions.allowedCategoryIds.length ? { category: { in: scope.permissions.allowedCategoryIds } } : {}) }
}
async function hydrate(ids: number[], context: Context, scope: Scope) {
  if (!ids.length) return []
  const result = await sdk.find({ collection: 'products', select: productProjection, where: { ...allowedWhere(scope), id: { in: ids } }, limit: ids.length, depth: 1 })
  const products = await attachWarehouseStock(result.docs)
  const byId = new Map(products.map(product => [product.id, catalogRecord(product, context, scope)]))
  return ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : [])
}
const syncPage = authed.catalog.syncPage.handler(async ({ input, context }) => {
  const scope = await catalogScope(context)
  let cursor: z.infer<typeof CatalogSyncCursorSchema> | undefined
  if (input.cursor) {
    try { cursor = CatalogSyncCursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString())) }
    catch { throw new ORPCError('BAD_REQUEST', { message: 'نشانگر کاتالوگ معتبر نیست.' }) }
  }
  if (cursor && cursor.scopeKey !== scope.scopeKey) return { scopeKey: scope.scopeKey, items: [], nextCursor: null }
  const watermark = cursor?.watermark ?? new Date().toISOString()
  const result = await sdk.find({ collection: 'products', select: productProjection, where: { and: [allowedWhere(scope), { createdAt: { less_than_equal: watermark } }, ...(cursor ? [{ or: [
    { createdAt: { less_than: cursor.createdAt } }, { and: [{ createdAt: { equals: cursor.createdAt } }, { id: { less_than: cursor.id } }] },
  ] }] : [])] }, sort: ['-createdAt', '-id'], limit: input.limit + 1, depth: 1 })
  const page = result.docs.slice(0, input.limit)
  const products = await attachWarehouseStock(page)
  const last = page.at(-1)
  const nextCursor = result.docs.length > input.limit && last ? Buffer.from(JSON.stringify({ watermark, createdAt: last.createdAt, id: last.id, scopeKey: scope.scopeKey })).toString('base64url') : null
  const offlineQr = input.includeOfflineQr && context.user?.role === 'customer' && scope.permissions.canUseProductQr
    ? products.flatMap(product => product.scanCode ? [{ id: product.id, scanCode: product.scanCode }] : [])
    : undefined
  return { scopeKey: scope.scopeKey, items: products.map(product => catalogRecord(product, context, scope)), nextCursor, offlineQr }
})
const getByIds = authed.catalog.getByIds.handler(async ({ input, context }) => {
  const scope = await catalogScope(context)
  return { scopeKey: scope.scopeKey, items: await hydrate([...new Set(input.ids)], context, scope) }
})
const browse = authed.catalog.browse.handler(async ({ input, context }) => {
  const scope = await catalogScope(context)
  const cmsUrl = process.env.CMS_API_URL || `${(process.env.CMS_URL || 'http://localhost:5174').replace(/\/+$/, '')}/api`
  const response = await fetch(`${cmsUrl}/catalog-browse`, { method: 'POST', signal: context.req.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `admins API-Key ${process.env.CMS_API_KEY || 'persianpart_dev_api_key_2026'}` },
    body: JSON.stringify({ ...input, allowedCategoryIds: scope.permissions.allowedCategoryIds, markupPercent: scope.permissions.markupPercent }),
  })
  if (!response.ok) throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'دریافت کاتالوگ ممکن نشد.' })
  const result = z.object({ ids: z.array(z.number().int().positive()), total: z.number().nonnegative() }).parse(await response.json())
  return { scopeKey: scope.scopeKey, items: await hydrate(result.ids, context, scope), total: result.total, hasMore: input.page * input.limit < result.total }
})
export const catalogSync = { syncPage, getByIds, browse }
