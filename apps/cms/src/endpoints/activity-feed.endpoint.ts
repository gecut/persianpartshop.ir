import type { Endpoint, PayloadRequest } from 'payload'
import { getAdminUser } from '../access/roles'

interface CandidateRow {
  kind: 'order' | 'supply'
  id: number
  created_at: string | Date
}

interface CursorPayload {
  createdAt: string
  id: number
  watermark: string
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof parsed.createdAt === 'string' &&
      typeof parsed.id === 'number' &&
      typeof parsed.watermark === 'string'
    ) {
      return {
        createdAt: parsed.createdAt,
        id: parsed.id,
        watermark: parsed.watermark,
      }
    }
    return null
  } catch {
    return null
  }
}

function resolveMediaUrl(cover: unknown): string | null {
  if (!cover) return null
  if (typeof cover === 'string') return cover
  if (typeof cover === 'object' && cover !== null) {
    const obj = cover as { url?: string; thumbnailURL?: string }
    return obj.url || obj.thumbnailURL || null
  }
  return null
}

const UNIT_MAP: Record<string, string> = {
  bag: 'کیسه',
  bucket: 'سطل',
  pack: 'بسته',
  can: 'قوطی',
  branch: 'شاخه',
  piece: 'عدد',
  box: 'کارتن',
  roll: 'رول',
  kg: 'کیلوگرم',
  liter: 'لیتر',
  m2: 'مترمربع',
  meter: 'متر',
  m: 'متر',
  cm: 'سانتی‌متر',
  g: 'گرم',
}

function formatUnitName(raw?: string | null): string {
  if (!raw) return 'عدد'
  return UNIT_MAP[raw] || raw
}

function summarizeOrderQuantities(items: Array<{ unit?: string | null; deliverableArea?: number | null }>): string {
  const totals = new Map<string, number>()
  for (const item of items) {
    const unit = item.unit || 'm2'
    const qty = Number(item.deliverableArea) || 0
    totals.set(unit, (totals.get(unit) ?? 0) + qty)
  }
  return [...totals]
    .map(([unit, qty]) => `${(Math.round(qty * 100) / 100).toLocaleString('fa-IR')} ${formatUnitName(unit)}`)
    .join('، ')
}

function getOrderStatusLabel(status: string, createdAt: string): string {
  if (status === 'pending') {
    const isPastHour = Date.now() >= new Date(createdAt).getTime() + 60 * 60 * 1000
    return isPastHour ? 'در حال بررسی واحد بازرگانی' : 'سفارش ثبت شده'
  }
  if (status === 'completed' || status === 'approve' || status === 'approved') return 'تکمیل شده'
  if (status === 'cancelled_by_customer') return 'لغو توسط کاربر'
  if (status === 'cancelled_by_admin') return 'لغو توسط ادمین'
  if (status === 'cancel' || status === 'cancelled') return 'لغو شده'
  return 'در حال بررسی'
}

function getSupplyStatusLabel(status: string): string {
  switch (status) {
    case 'new':
      return 'ثبت‌شده'
    case 'reviewing':
      return 'در حال بررسی'
    case 'supplied':
      return 'تأمین شده'
    case 'unavailable':
      return 'غیرقابل تأمین'
    case 'cancelled_by_customer':
      return 'لغو توسط مشتری'
    default:
      return 'در حال بررسی'
  }
}

export const activityFeedEndpoint: Endpoint = {
  path: '/activity-feed',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const actor = getAdminUser(req.user)
    if (!actor || !['service', 'manager', 'superadmin'].includes(actor.role)) {
      return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    }

    const url = new URL(req.url || '', 'http://localhost')
    const userId = Number(url.searchParams.get('userId'))
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return Response.json({ error: 'شناسه مشتری نامعتبر است.' }, { status: 400 })
    }

    const filter = url.searchParams.get('filter') || 'all'
    const orderStatus = url.searchParams.get('orderStatus') || undefined
    const limitParam = Number(url.searchParams.get('limit')) || 20
    const limit = Math.min(Math.max(1, limitParam), 50)
    const cursorParam = url.searchParams.get('cursor')
    const cursor = cursorParam ? decodeCursor(cursorParam) : null
    const watermark = cursor?.watermark || new Date().toISOString()
    const fetchLimit = limit + 1

    let candidateRows: CandidateRow[] = []

    const pool = (req.payload.db as unknown as { pool?: { query: (text: string, params: unknown[]) => Promise<{ rows: CandidateRow[] }> } })?.pool
    if (pool && typeof pool.query === 'function') {
      const params: unknown[] = [userId, watermark]
      let orderStatusSql = ''
      if (orderStatus && filter !== 'supply') {
        params.push(orderStatus)
        orderStatusSql = `AND status = $${params.length}`
      }
      const cursorTimeParam = `$${params.length + 1}`
      params.push(cursor ? cursor.createdAt : null)
      const cursorIdParam = `$${params.length + 1}`
      params.push(cursor ? cursor.id : 0)
      const limitParamIndex = `$${params.length + 1}`
      params.push(fetchLimit)

      const orderPart = filter !== 'supply' ? `
        SELECT 'order'::text AS kind, id, created_at
        FROM orders
        WHERE user_id = $1 AND created_at <= $2::timestamptz ${orderStatusSql}
      ` : ''

      const supplyPart = (filter !== 'order' && !orderStatus) ? `
        SELECT 'supply'::text AS kind, id, created_at
        FROM supply_requests
        WHERE user_id = $1 AND created_at <= $2::timestamptz
      ` : ''

      let unionSql = ''
      if (orderPart && supplyPart) {
        unionSql = `${orderPart} UNION ALL ${supplyPart}`
      } else if (orderPart) {
        unionSql = orderPart
      } else if (supplyPart) {
        unionSql = supplyPart
      } else {
        return Response.json({ items: [], nextCursor: null, hasMore: false })
      }

      const querySql = `
        WITH candidates AS (
          ${unionSql}
        )
        SELECT kind, id, created_at
        FROM candidates
        WHERE (${cursorTimeParam}::timestamptz IS NULL OR (created_at < ${cursorTimeParam}::timestamptz OR (created_at = ${cursorTimeParam}::timestamptz AND id < ${cursorIdParam})))
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitParamIndex};
      `

      const result = await pool.query(querySql, params)
      candidateRows = result.rows
    } else {
      // Memory fallback for SQLite or unit environments
      const orders = filter !== 'supply' ? await req.payload.find({
        collection: 'orders',
        where: {
          and: [
            { user: { equals: userId } },
            { createdAt: { less_than_equal: watermark } },
            ...(orderStatus ? [{ status: { equals: orderStatus } }] : []),
          ],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      }) : { docs: [] }

      const supplies = (filter !== 'order' && !orderStatus) ? await req.payload.find({
        collection: 'supply-requests',
        where: {
          and: [
            { user: { equals: userId } },
            { createdAt: { less_than_equal: watermark } },
          ],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      }) : { docs: [] }

      const all = [
        ...orders.docs.map(o => ({ kind: 'order' as const, id: Number(o.id), created_at: o.createdAt })),
        ...supplies.docs.map(s => ({ kind: 'supply' as const, id: Number(s.id), created_at: s.createdAt })),
      ].sort((a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return timeDiff !== 0 ? timeDiff : b.id - a.id
      })

      const afterCursor = cursor
        ? all.filter(item => {
            const time = new Date(item.created_at).getTime()
            const cursorTime = new Date(cursor.createdAt).getTime()
            return time < cursorTime || (time === cursorTime && item.id < cursor.id)
          })
        : all

      candidateRows = afterCursor.slice(0, fetchLimit)
    }

    const hasMore = candidateRows.length > limit
    const pageRows = candidateRows.slice(0, limit)

    const orderIds = pageRows.filter(r => r.kind === 'order').map(r => r.id)
    const supplyIds = pageRows.filter(r => r.kind === 'supply').map(r => r.id)

    const [ordersResult, suppliesResult] = await Promise.all([
      orderIds.length
        ? req.payload.find({
            collection: 'orders',
            where: { id: { in: orderIds } },
            depth: 1,
            pagination: false,
            overrideAccess: true,
          })
        : { docs: [] },
      supplyIds.length
        ? req.payload.find({
            collection: 'supply-requests',
            where: { id: { in: supplyIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
          })
        : { docs: [] },
    ])

    const orderMap = new Map<number, (typeof ordersResult.docs)[number]>()
    for (const doc of ordersResult.docs) orderMap.set(Number(doc.id), doc)

    const supplyMap = new Map<number, (typeof suppliesResult.docs)[number]>()
    for (const doc of suppliesResult.docs) supplyMap.set(Number(doc.id), doc)

    const items: unknown[] = []
    for (const row of pageRows) {
      if (row.kind === 'order') {
        const doc = orderMap.get(row.id)
        if (!doc) continue
        const rawItems = (doc.items || []) as Array<{
          product?: { cover?: unknown; gallery?: Array<{ image?: unknown }> } | number
          productImage?: string
          unit?: string
          deliverableArea?: number
        }>
        const productImages = rawItems
          .map(item => {
            if (item.productImage) return item.productImage
            if (typeof item.product === 'object' && item.product) {
              return resolveMediaUrl(item.product.cover) || resolveMediaUrl(item.product.gallery?.[0]?.image)
            }
            return null
          })
          .filter((img): img is string => typeof img === 'string')

        const isCancelled = ['cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'].includes(doc.status)
        items.push({
          kind: 'order',
          id: String(doc.id),
          orderNumber: String(doc.trackingNumber ?? doc.orderNumber),
          status: doc.status,
          statusLabel: getOrderStatusLabel(doc.status, doc.createdAt),
          createdAt: doc.createdAt,
          totalAmount: Number(doc.finalTotal) || 0,
          itemCount: rawItems.length || 1,
          quantitySummary: summarizeOrderQuantities(rawItems),
          productImages,
          canReorder: !isCancelled,
        })
      } else if (row.kind === 'supply') {
        const doc = supplyMap.get(row.id)
        if (!doc) continue
        const isOverdue = ['new', 'reviewing'].includes(doc.status) && Date.now() >= new Date(doc.responseDueAt).getTime()
        items.push({
          kind: 'supply',
          id: Number(doc.id),
          requestNumber: String(doc.trackingNumber ?? doc.requestNumber),
          status: doc.status,
          statusLabel: getSupplyStatusLabel(doc.status),
          createdAt: doc.createdAt,
          estimatedTotal: Number(doc.estimatedTotal) || 0,
          productName: doc.productName,
          productImage: doc.productImage ?? null,
          requestedQuantity: Number(doc.requestedQuantity),
          roundedQuantity: Number(doc.roundedQuantity),
          unit: doc.unit,
          packageCount: Number(doc.packageCount),
          cartonsPerPallet: doc.cartonsPerPallet ? Number(doc.cartonsPerPallet) : null,
          responseDueAt: doc.responseDueAt,
          canCancel: doc.status === 'new' && !doc.reviewStartedAt,
          isOverdue,
        })
      }
    }

    const lastItem = pageRows[pageRows.length - 1]
    const nextCursor = hasMore && lastItem
      ? encodeCursor({
          createdAt: typeof lastItem.created_at === 'string' ? lastItem.created_at : lastItem.created_at.toISOString(),
          id: lastItem.id,
          watermark,
        })
      : null

    return Response.json({
      items,
      nextCursor,
      hasMore,
    })
  },
}
