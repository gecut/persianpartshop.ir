import { ActivityFeedItemSchema, CatalogFacetOutputSchema, CatalogRecordSchema, CustomerOrderDocumentSchema, PlanSchema, SupplyRequestSchema } from '@persianpart/contract'
import { api } from '@/lib/api-client'
import { catalogProductImages, resolveMediaUrl } from '@/modules/products/catalog-mapper'
import { authStore, isProductAllowedForUser } from '@/modules/auth/auth-store'
import type { CustomerDocument } from '@/modules/account/profile-view/_document-types'
import { publicImageUrl, type OfflinePackage } from './offline-storage'

const cdn = new URL(import.meta.env.VITE_CDN_URL || 'https://cdn.persianpart.shop').origin

export type OfflinePhase = 'checking' | 'catalog' | 'history' | 'qr' | 'images' | 'verifying'
export interface OfflineProgress {
  phase: OfflinePhase
  done?: number
  total?: number
  reused?: number
  bytes?: number
}

type Report = (progress: OfflineProgress) => void

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? error.code : null
}

function orderImage(cover: unknown) {
  // The history UI treats numeric strings as media IDs, not file paths.
  return typeof cover === 'string' && !cover.startsWith('/') ? '' : resolveMediaUrl(cover)
}

export async function downloadOfflineData(pack: OfflinePackage, canUseQr: boolean, signal: AbortSignal, save: () => Promise<void>, report: Report) {
  const { data } = pack
  const options = { signal }
  report({ phase: 'catalog', done: Object.keys(data.products).length })
  while (!pack.catalogDone) {
    signal.throwIfAborted()
    const page = await api.catalog.syncPage({ cursor: pack.cursor, limit: 100, includeOfflineQr: canUseQr }, options)
    if (page.scopeKey !== pack.scopeKey || (page.nextCursor && page.nextCursor === pack.cursor)) throw new Error('scope')
    const records = page.items.map(item => CatalogRecordSchema.parse(item))
    const codes = new Map(page.offlineQr?.map(item => [item.id, item.scanCode]))
    for (const record of records) {
      data.products[record.id] = record
      if (canUseQr && record.hasScanCode) {
        const code = codes.get(Number(record.id))
        if (!code || !record.scanHash) throw new Error('qr')
        data.qr[record.id] = code
      }
    }
    if (!page.nextCursor) {
      const facets = CatalogFacetOutputSchema.parse(await api.catalog.facets(undefined, options))
      if (facets.scopeKey !== pack.scopeKey) throw new Error('scope')
      data.dimensions = facets.dimensions
      pack.catalogDone = true
    }
    pack.cursor = page.nextCursor ?? undefined
    await save()
    report({ phase: 'catalog', done: Object.keys(data.products).length })
  }

  report({ phase: 'history' })
  if (!data.profile) {
    const profile = await api.user.profile(undefined, options)
    if (!profile || String(profile.id) !== pack.owner) throw new Error('scope')
    data.profile = {
      name: profile.fullName ?? '',
      storeName: profile.companyName ?? '',
      phone: profile.phone ?? '',
      documents: (profile.documents ?? []).map((doc: CustomerDocument) => ({
        id: doc.id, documentType: doc.documentType, title: doc.title, status: doc.status,
        rejectionReason: doc.rejectionReason, uploadedAt: doc.uploadedAt,
      })),
    }
    await save()
  }
  if (!pack.plansDone) {
    const plans = new Map<string, OfflinePackage['data']['plans'][number]>()
    for (let page = 1; ; page++) {
      signal.throwIfAborted()
      const result = await api.plan.list({ page, limit: 50 }, options)
      for (const raw of result.items) {
        const plan = PlanSchema.parse({
          ...raw, id: String(raw.id),
          startsAt: raw.startsAt ?? undefined, expiresAt: raw.expiresAt ?? undefined,
          title: raw.title ?? undefined, dynamicTitle: raw.dynamicTitle ?? undefined,
          notes: raw.notes ?? undefined, content: raw.content ?? undefined,
          hasTimer: raw.hasTimer ?? undefined, isActive: raw.isActive ?? undefined,
          products: raw.products ?? undefined, users: raw.users ?? undefined,
        })
        const products = plan.products?.filter(product => typeof product === 'object'
          ? isProductAllowedForUser(product, authStore.getState().user)
          : !!data.products[product])
        plans.set(plan.id, { ...plan, products })
      }
      if (!result.hasMore) {
        if (plans.size !== result.total) throw new Error('history')
        break
      }
    }
    data.plans = [...plans.values()]
    pack.plansDone = true
    await save()
  }

  async function listActivity() {
    const result = new Map<string, OfflinePackage['data']['activity'][number]>()
    for (const filter of ['order', 'supply'] as const) {
      let cursor: string | undefined
      do {
        signal.throwIfAborted()
        const page = await api.activityFeed.list({ filter, cursor, limit: 50 }, options)
        for (const raw of page.items) {
          const item = ActivityFeedItemSchema.parse(raw)
          result.set(`${item.kind}:${item.id}`, item)
        }
        if (page.hasMore && (!page.nextCursor || page.nextCursor === cursor)) throw new Error('history')
        cursor = page.hasMore ? page.nextCursor ?? undefined : undefined
      } while (cursor)
    }
    return result
  }

  if (!pack.activityDone) {
    data.activity = [...(await listActivity()).values()]
    pack.activityDone = true
    await save()
  }
  let remaining = data.activity.filter(item => !(item.kind === 'order' ? data.orders[item.id] : data.supplies[item.id]))
  let done = data.activity.length - remaining.length
  report({ phase: 'history', done, total: data.activity.length })
  for (let attempt = 0; remaining.length && attempt < 2; attempt++) {
    let missing = false
    for (const item of remaining) {
      signal.throwIfAborted()
      try {
        if (item.kind === 'order') {
          const order = CustomerOrderDocumentSchema.parse(await api.order.getById({ id: item.id }, options))
          if (String(order.id) !== String(item.id)) throw new Error('history')
          data.orders[item.id] = order
        } else {
          const request = SupplyRequestSchema.parse(await api.supplyRequest.detail({ id: Number(item.id) }, options))
          if (String(request.id) !== String(item.id)) throw new Error('history')
          data.supplies[item.id] = request
        }
        await save()
        report({ phase: 'history', done: ++done, total: data.activity.length })
      } catch (error) {
        if (errorCode(error) !== 'NOT_FOUND') throw error
        missing = true
      }
    }
    if (!missing) break
    const current = await listActivity()
    data.activity = [...current.values()]
    for (const id of Object.keys(data.orders)) if (!current.has(`order:${id}`)) delete data.orders[id]
    for (const id of Object.keys(data.supplies)) if (!current.has(`supply:${id}`)) delete data.supplies[id]
    await save()
    remaining = data.activity.filter(item => !(item.kind === 'order' ? data.orders[item.id] : data.supplies[item.id]))
    done = data.activity.length - remaining.length
    report({ phase: 'history', done, total: data.activity.length })
  }
  if (data.activity.some(item => !(item.kind === 'order' ? data.orders[item.id] : data.supplies[item.id]))) throw new Error('history')
}

export function offlineImages(data: OfflinePackage['data']) {
  const urls = new Set<string>()
  function add(raw: string | null | undefined) {
    if (!raw || raw === '/assets/images/placeholder.svg') return
    const url = publicImageUrl(raw, location.origin, cdn)
    if (!url) throw new Error('image')
    urls.add(url)
  }
  for (const record of Object.values(data.products)) catalogProductImages(record).images.forEach(add)
  for (const item of data.activity) {
    if (item.kind === 'order') item.productImages.forEach(add)
    else add(item.productImage)
  }
  for (const order of Object.values(data.orders)) {
    for (const item of order.items) if (typeof item.product === 'object') add(orderImage(item.product.cover))
  }
  for (const supply of Object.values(data.supplies)) add(supply.productImage)
  for (const plan of data.plans) {
    for (const product of plan.products ?? []) {
      if (typeof product !== 'object' || data.products[String(product.id)] || !Array.isArray(product.images)) continue
      for (const image of product.images) {
        add(typeof image === 'object' && image && 'url' in image && image.url ? String(image.url) : String(image))
      }
    }
  }
  return [...urls]
}
