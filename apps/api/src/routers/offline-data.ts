import { call, ORPCError } from '@orpc/server'
import { OfflineSnapshotSchema, type OfflineSnapshot, type ActivityFeedOutput } from '@persianpart/contract'
import type { Context } from '../rpc/context'
import { activityFeed } from './activity-feed'
import { catalog } from './catalog'
import { order } from './order'
import { plan } from './plan'
import { supplyRequest } from './supply-request'
import { user } from './user'

export async function readOfflineData(context: Context, scopeKey: string): Promise<OfflineSnapshot> {
  const data: OfflineSnapshot = {
    products: {}, dimensions: [], qr: {}, activity: [], orders: {}, supplies: {}, plans: [],
    profile: { name: '', storeName: '', phone: '', documents: [] },
  }
  const activityKeys = new Set<string>()
  const options = { context, signal: context.req.signal }
  const scope = (key: string) => {
    if (scopeKey !== key) throw new ORPCError('CONFLICT')
  }
  let cursor: string | undefined
  do {
    context.req.signal.throwIfAborted()
    const page = await call(catalog.syncPage, { limit: 100, cursor, includeOfflineQr: true }, options)
    scope(page.scopeKey)
    for (const item of page.items) data.products[item.id] = item
    for (const item of page.offlineQr ?? []) data.qr[item.id] = item.scanCode
    if (page.nextCursor && page.nextCursor === cursor) throw new ORPCError('CONFLICT')
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  const facets = await call(catalog.facets, undefined, options)
  scope(facets.scopeKey)
  data.dimensions = facets.dimensions
  const profile = await call(user.profile, undefined, options)
  if (!profile || String(profile.id) !== String(context.user?.id)) throw new ORPCError('UNAUTHORIZED')
  data.profile = {
    name: profile.fullName ?? '', storeName: profile.companyName ?? '', phone: profile.phone ?? '',
    documents: (profile.documents ?? []).map((document: Record<string, unknown>) => ({
      id: document.id == null ? undefined : String(document.id),
      documentType: document.documentType ?? undefined, title: document.title ?? undefined,
      status: document.status ?? undefined, rejectionReason: document.rejectionReason ?? undefined,
      uploadedAt: document.uploadedAt ?? undefined,
    })),
  }
  for (let page = 1; ; page++) {
    context.req.signal.throwIfAborted()
    const result = await call(plan.list, { page, limit: 50 }, options)
    for (const raw of result.items) {
      const parsed = OfflineSnapshotSchema.shape.plans.element.parse({
        ...raw, id: String(raw.id), startsAt: raw.startsAt ?? undefined, expiresAt: raw.expiresAt ?? undefined,
        title: raw.title ?? undefined, dynamicTitle: raw.dynamicTitle ?? undefined, notes: raw.notes ?? undefined,
        content: raw.content ?? undefined, hasTimer: raw.hasTimer ?? undefined, isActive: raw.isActive ?? undefined,
        products: Array.isArray(raw.products) ? (raw.products as unknown[]).flatMap(product => {
          const id = product && typeof product === 'object' && 'id' in product ? String(product.id) : String(product)
          return Object.hasOwn(data.products, id) ? [id] : []
        }) : undefined,
        users: raw.users ?? undefined,
      })
      data.plans.push(parsed)
    }
    if (!result.hasMore) {
      if (new Set(data.plans.map(item => item.id)).size !== result.total) throw new ORPCError('CONFLICT')
      break
    }
  }
  for (const filter of ['order', 'supply'] as const) {
    cursor = undefined
    do {
      context.req.signal.throwIfAborted()
      const page: ActivityFeedOutput = await call(activityFeed.list, { filter, limit: 50, cursor }, options)
      if (page.hasMore && (!page.nextCursor || page.nextCursor === cursor)) throw new ORPCError('CONFLICT')
      for (const item of page.items) {
        const key = item.kind + ':' + item.id
        if (item.kind !== filter || activityKeys.has(key)) throw new ORPCError('CONFLICT')
        activityKeys.add(key)
        if (item.kind === 'order') data.orders[item.id] = await call(order.getById, { id: String(item.id) }, options)
        else data.supplies[item.id] = await call(supplyRequest.detail, { id: Number(item.id) }, options)
        data.activity.push(item)
      }
      cursor = page.hasMore ? page.nextCursor ?? undefined : undefined
    } while (cursor)
  }
  return OfflineSnapshotSchema.parse(data)
}

export function structuralOfflineData(data: OfflineSnapshot) {
  return {
    ...data,
    products: Object.fromEntries(Object.entries(data.products).map(([id, product]) => {
      const { inventorySqm, stockCartons, availability, matchesInStockFilter, ...structural } = product
      return [id, structural]
    })),
    plans: [...data.plans].sort((a, b) => a.id.localeCompare(b.id)).map(plan => {
      const { isExpired, status, ...structural } = plan
      return structural
    }),
    activity: data.activity.map(item => {
      if (item.kind === 'order') return item
      const { isOverdue, ...structural } = item
      return structural
    }),
    supplies: Object.fromEntries(Object.entries(data.supplies).map(([id, supply]) => {
      const { isOverdue, ...structural } = supply
      return [id, structural]
    })),
  }
}
