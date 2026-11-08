import { createHash } from 'node:crypto'
import { ORPCError } from '@orpc/server'
import { calculateSupplyEstimate, getSalesFactor } from '@persianpart/cms/inventory'
import type { SupplyRequest as SupplyDocument } from '@persianpart/cms/types'
import { customerOnly } from '../rpc/base'
import { sdk } from '../payload'
import { getUserPermissions } from './router.helpers'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const idOf = (value: number | { id: number }) => typeof value === 'number' ? value : value.id
const map = (doc: SupplyDocument) => ({
  id: doc.id, requestNumber: doc.requestNumber, status: doc.status, productId: idOf(doc.product), productName: doc.productName, productSku: doc.productSku, productImage: doc.productImage ?? null,
  warehouseId: idOf(doc.warehouse), warehouseName: doc.warehouseName, warehouseCode: doc.warehouseCode, productType: doc.productType as 'tile' | 'other', unit: doc.unit,
  requestedQuantity: doc.requestedQuantity, packageCount: doc.packageCount, roundedQuantity: doc.roundedQuantity, salesFactor: doc.salesFactor, cartonsPerPallet: doc.cartonsPerPallet ?? null,
  estimatedUnitPrice: doc.estimatedUnitPrice, estimatedTotal: doc.estimatedTotal, notes: doc.notes ?? '', createdAt: doc.createdAt, updatedAt: doc.updatedAt, responseDueAt: doc.responseDueAt,
  reviewStartedAt: doc.reviewStartedAt ?? null, resolvedAt: doc.resolvedAt ?? null, cancelledAt: doc.cancelledAt ?? null,
  canCancel: doc.status === 'new' && !doc.reviewStartedAt, isOverdue: ['new', 'reviewing'].includes(doc.status) && Date.now() >= new Date(doc.responseDueAt).getTime(),
})
const requireActive = async (userId: number) => {
  const user = await sdk.findByID({ collection: 'users', id: userId, depth: 0 })
  if (user.status !== 'active') throw new ORPCError('FORBIDDEN', { message: 'حساب مشتری فعال نیست.' })
}
const findOwned = async (id: number, userId: number) => {
  const found = await sdk.find({ collection: 'supply-requests', where: { and: [{ id: { equals: id } }, { user: { equals: userId } }] }, limit: 1, depth: 0 })
  const doc = found.docs[0]
  if (!doc) throw new ORPCError('NOT_FOUND', { message: 'درخواست یافت نشد.' })
  return doc
}
const preview = customerOnly.supplyRequest.preview.handler(async ({ input, context }) => {
  const userId = Number(context.user.id)
  await requireActive(userId)
  const permissions = await getUserPermissions(userId)
  if (permissions.disableOrdering || permissions.hideExactStock) throw new ORPCError('FORBIDDEN')
  const product = await sdk.findByID({ collection: 'products', id: input.productId, depth: 0 })
  if (!product.isActive) throw new ORPCError('NOT_FOUND')
  const category = product.category ? idOf(product.category) : null
  if (permissions.allowedCategoryIds.length && (!category || !permissions.allowedCategoryIds.includes(category))) throw new ORPCError('FORBIDDEN')
  const salesFactor = getSalesFactor(product)
  const estimate = calculateSupplyEstimate({ requestedQuantity: input.requestedQuantity, salesFactor, basePrice: Number(product.basePricePerSqm ?? 0), markupPercent: permissions.markupPercent })
  const sources = await sdk.find({ collection: 'supply-sources', where: { and: [{ product: { equals: input.productId } }, { isActive: { equals: true } }, { 'warehouse.isActive': { equals: true } }, { 'warehouse.stockMode': { equals: 'inquiry' } }] }, pagination: false, depth: 1 })
  const warehouses = sources.docs.flatMap(source => typeof source.warehouse === 'object' ? [{ id: source.warehouse.id, name: source.warehouse.name, code: source.warehouse.code }] : [])
  const stock = await sdk.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: input.productId } }, { inventorySqm: { greater_than_equal: estimate.roundedQuantity } }, { 'warehouse.isActive': { equals: true } }, { 'warehouse.stockMode': { equals: 'exact' } }] }, limit: 1, depth: 0 })
  const reason = stock.docs.length ? 'exact_stock_available' as const : warehouses.length ? null : 'no_active_source' as const
  return { eligible: reason === null, reason, warehouses, quote: { productId: input.productId, productType: product.productType ?? 'tile', unit: product.productType === 'other' ? product.unit ?? 'piece' : 'm2', requestedQuantity: input.requestedQuantity, salesFactor, cartonsPerPallet: product.productType === 'other' ? null : product.cartonsPerPallet ?? null, ...estimate } }
})
const submit = customerOnly.supplyRequest.submit.handler(async ({ input, context }) => {
  const userId = Number(context.user.id)
  await requireActive(userId)
  const key = hash(`${userId}:${input.idempotencyKey}`)
  const fingerprint = hash(JSON.stringify([input.productId, input.warehouseId, input.requestedQuantity, (input.notes ?? '').trim()]))
  const replay = async () => (await sdk.find({ collection: 'supply-requests', where: { and: [{ user: { equals: userId } }, { idempotencyKey: { equals: key } }] }, limit: 1, depth: 0 })).docs[0]
  const resolveReplay = (doc: SupplyDocument) => {
    if (doc.requestFingerprint !== fingerprint) throw new ORPCError('CONFLICT', { message: 'کلید ثبت برای درخواست دیگری استفاده شده است.' })
    return map(doc)
  }
  const previous = await replay()
  if (previous) return resolveReplay(previous)
  const permissions = await getUserPermissions(userId)
  if (permissions.disableOrdering || permissions.hideExactStock) throw new ORPCError('FORBIDDEN')
  try {
    const doc = await sdk.create({ collection: 'supply-requests', data: { user: userId, product: input.productId, warehouse: input.warehouseId, requestedQuantity: input.requestedQuantity, notes: input.notes ?? '', idempotencyKey: input.idempotencyKey } as never })
    return map(doc)
  } catch (error) {
    const winner = await replay()
    if (winner) return resolveReplay(winner)
    const detail = error instanceof Error ? error.message : ''
    if (detail === 'EXACT_STOCK_AVAILABLE') throw new ORPCError('EXACT_STOCK_AVAILABLE', { message: 'موجودی قطعی برای خرید کافی است.' })
    if (detail === 'SOURCE_UNAVAILABLE') throw new ORPCError('SOURCE_UNAVAILABLE', { message: 'منبع تأمین در دسترس نیست.' })
    if (detail.includes('FORBIDDEN')) throw new ORPCError('FORBIDDEN')
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'ثبت درخواست ممکن نشد؛ دوباره تلاش کنید.' })
  }
})
const list = customerOnly.supplyRequest.list.handler(async ({ input, context }) => {
  const userId = Number(context.user.id)
  await requireActive(userId)
  const result = await sdk.find({ collection: 'supply-requests', where: { and: [{ user: { equals: userId } }, ...(input.status ? [{ status: { equals: input.status } }] : [])] }, sort: '-createdAt', page: input.page, limit: input.limit, depth: 0 })
  return { items: result.docs.map(map), total: result.totalDocs, page: input.page, limit: input.limit, totalPages: result.totalPages }
})
const detail = customerOnly.supplyRequest.detail.handler(async ({ input, context }) => { const userId = Number(context.user.id); await requireActive(userId); return map(await findOwned(input.id, userId)) })
const cancel = customerOnly.supplyRequest.cancel.handler(async ({ input, context }) => {
  const userId = Number(context.user.id)
  await requireActive(userId)
  const doc = await findOwned(input.id, userId)
  if (doc.status === 'cancelled_by_customer') return map(doc)
  try { return map(await sdk.update({ collection: 'supply-requests', id: doc.id, data: { status: 'cancelled_by_customer' }, depth: 0 })) }
  catch (error) {
    if (error instanceof Error && error.message === 'CANNOT_CANCEL') throw new ORPCError('CANNOT_CANCEL', { message: 'لغو این درخواست ممکن نیست.' })
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'لغو درخواست ممکن نشد؛ دوباره تلاش کنید.' })
  }
})
export const supplyRequest = { preview, submit, list, detail, cancel }
