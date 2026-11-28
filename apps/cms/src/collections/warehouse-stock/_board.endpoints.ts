import { sql } from '@payloadcms/db-postgres'
import type {
  StockBoardCell,
  StockBoardResponse,
  StockBoardRow,
  StockBoardWarehouse,
  StockInquiryUpdateResult,
} from '@persianpart/contract'
import { APIError, commitTransaction, initTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'
import { getReadDb, getTransactionDb } from '../../lib/transaction'
import { businessError } from '../../lib/validation'
import type { Product, WarehouseStock } from '../../payload-types'
import { getSalesFactor } from '../products/_inventory-math'
import { manageWarehouses } from '../warehouses/warehouses.collection'
import { escapeLike, parseBoardQuery, parseInquiryBody, type BoardQuery } from './_board-query'

const exactStock = sql`EXISTS (SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id = s.warehouse_id WHERE s.product_id = p.id AND w.is_active AND w.stock_mode = 'exact' AND s.is_active AND s.inventory_sqm > 0)`
const inquirable = sql`EXISTS (SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id = s.warehouse_id WHERE s.product_id = p.id AND w.is_active AND w.stock_mode = 'inquiry' AND s.is_active)`

function buildBoardWhere(query: BoardQuery) {
  const pattern = `%${escapeLike(query.q)}%`
  const searchSql = query.q
    ? sql`(p.name ILIKE ${pattern} ESCAPE '\\' OR p.sku ILIKE ${pattern} ESCAPE '\\')`
    : sql`TRUE`
  const categorySql = query.category !== null ? sql`p.category_id = ${query.category}` : sql`TRUE`
  const brandSql = query.brand !== null ? sql`p.brand_id = ${query.brand}` : sql`TRUE`
  const filterSql = {
    all: sql`TRUE`,
    in_stock: exactStock,
    out_of_stock: sql`NOT ${exactStock}`,
    inquiry: inquirable,
    not_inquiry: sql`NOT ${inquirable}`,
  }[query.filter]
  return sql`${searchSql} AND ${categorySql} AND ${brandSql} AND ${filterSql}`
}

export async function readStockBoard(req: PayloadRequest, query: BoardQuery): Promise<StockBoardResponse> {
  if (!await manageWarehouses({ req })) throw businessError('دسترسی مجاز نیست.', 'FORBIDDEN', 403)
  const db = await getReadDb(req)
  const where = buildBoardWhere(query)
  const offset = (query.page - 1) * query.limit
  const { rows: pageRows } = await db.execute(sql`
    SELECT p.id, COUNT(*) OVER() AS total FROM products p
    WHERE ${where}
    ORDER BY p.name, p.id LIMIT ${query.limit} OFFSET ${offset}
  `)
  const ids = pageRows.map(row => Number(row.id))
  let totalDocs = Number(pageRows[0]?.total ?? 0)
  if (pageRows.length === 0 && query.page > 1) {
    const { rows: [countRow] } = await db.execute(sql`SELECT COUNT(*) AS total FROM products p WHERE ${where}`)
    totalDocs = Number(countRow?.total ?? 0)
  }

  const warehousesPromise = req.payload.find({
    collection: 'warehouses',
    where: { isActive: { equals: true } },
    sort: ['name', 'id'],
    pagination: false,
    depth: 0,
    select: { code: true, name: true, stockMode: true },
    req,
    overrideAccess: false,
  })
  const productsPromise = ids.length
    ? req.payload.find({
        collection: 'products',
        where: { id: { in: ids } },
        pagination: false,
        depth: 0,
        select: { sku: true, name: true, productType: true, unit: true, sqmPerCarton: true, basePricePerSqm: true, isActive: true },
        req,
        overrideAccess: false,
      })
    : Promise.resolve({ docs: [] as Product[] })
  const balancesPromise = ids.length
    ? req.payload.find({
        collection: 'warehouse-stock',
        where: { product: { in: ids } },
        pagination: false,
        depth: 0,
        select: { product: true, warehouse: true, inventorySqm: true, revision: true, isActive: true, lastReportedAt: true },
        req,
        overrideAccess: false,
      })
    : Promise.resolve({ docs: [] as WarehouseStock[] })

  const [warehousesResult, productsResult, balancesResult] = await Promise.all([
    warehousesPromise,
    productsPromise,
    balancesPromise,
  ])

  const warehouses: StockBoardWarehouse[] = warehousesResult.docs.map(w => ({
    id: w.id,
    code: w.code,
    name: w.name,
    stockMode: w.stockMode,
  }))

  const productById = new Map(productsResult.docs.map(p => [p.id, p]))
  const balanceByKey = new Map(
    balancesResult.docs.map(b => {
      const productId = typeof b.product === 'object' ? b.product.id : b.product
      const warehouseId = typeof b.warehouse === 'object' ? b.warehouse.id : b.warehouse
      return [`${productId}:${warehouseId}`, b] as const
    }),
  )

  const rows: StockBoardRow[] = []
  for (const id of ids) {
    const product = productById.get(id)
    if (!product) continue
    let salesFactor: number | null = null
    try {
      salesFactor = getSalesFactor(product)
    } catch {
      salesFactor = null
    }
    const cells: Record<string, StockBoardCell | null> = {}
    for (const w of warehouses) {
      const balance = balanceByKey.get(`${product.id}:${w.id}`)
      cells[String(w.id)] = balance
        ? {
            amount: balance.inventorySqm ?? null,
            revision: balance.revision,
            isActive: balance.isActive,
            lastReportedAt: balance.lastReportedAt ?? null,
          }
        : null
    }
    rows.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      productType: product.productType === 'other' ? 'other' : 'tile',
      unit: product.unit ?? null,
      salesFactor,
      basePricePerSqm: product.basePricePerSqm ?? null,
      isActive: Boolean(product.isActive),
      cells,
    })
  }

  return {
    warehouses,
    rows,
    page: query.page,
    limit: query.limit,
    totalDocs,
    totalPages: Math.max(1, Math.ceil(totalDocs / query.limit)),
  }
}

export async function updateInquiry(req: PayloadRequest, body: unknown): Promise<StockInquiryUpdateResult> {
  if (!await manageWarehouses({ req }) || !req.user) {
    throw businessError('دسترسی مجاز نیست.', 'FORBIDDEN', 403)
  }
  const input = parseInquiryBody(body)
  if (!input) {
    throw businessError('ورودی نامعتبر است.', 'INVALID_INPUT', 400)
  }

  const started = await initTransaction(req)
  try {
    const db = await getTransactionDb(req)
    const { rows: [warehouse] } = await db.execute(sql`
      SELECT name FROM warehouses WHERE id = ${input.warehouseId} AND is_active = true AND stock_mode = 'inquiry' FOR SHARE
    `)
    if (!warehouse) {
      throw businessError('انبار استعلامی فعال نیست.', 'WAREHOUSE_UNAVAILABLE', 409)
    }

    const ids = input.changes.map(c => c.productId)
    const { rows: products } = await db.execute(sql`
      SELECT id FROM products
      WHERE id = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])
      -- NO KEY UPDATE conflicts with the FOR SHARE/UPDATE product locks taken by every other
      -- warehouse-stock creator, so concurrent creates of the same row are serialized here.
      ORDER BY id FOR NO KEY UPDATE
    `)
    if (products.length !== ids.length) {
      throw businessError('برخی کالاها یافت نشدند.', 'PRODUCT_NOT_FOUND', 404)
    }

    let enabled = 0
    let disabled = 0
    const changedIds: number[] = []
    const now = new Date().toISOString()

    for (const change of input.changes) {
      const { rows: [existing] } = await db.execute(sql`
        SELECT id, is_active FROM warehouse_stock
        WHERE warehouse_id = ${input.warehouseId} AND product_id = ${change.productId} FOR UPDATE
      `)
      if (!existing) {
        if (!change.enabled) continue
        await req.payload.create({
          collection: 'warehouse-stock',
          data: {
            warehouse: input.warehouseId,
            product: change.productId,
            inventorySqm: null,
            revision: 0,
            isActive: true,
            lastReportedAt: now,
          },
          req,
          overrideAccess: false,
        })
        enabled++
        changedIds.push(change.productId)
        continue
      }
      if (Boolean(existing.is_active) === change.enabled) continue
      await req.payload.update({
        collection: 'warehouse-stock',
        id: Number(existing.id),
        data: change.enabled ? { isActive: true, lastReportedAt: now } : { isActive: false },
        req,
        overrideAccess: false,
      })
      if (change.enabled) enabled++
      else disabled++
      changedIds.push(change.productId)
    }

    if (enabled + disabled > 0) {
      await req.payload.create({
        collection: 'audit-logs',
        req,
        overrideAccess: true,
        data: {
          action: 'other',
          entity: 'products',
          admin: Number(req.user.id),
          adminName: 'name' in req.user ? String(req.user.name) : '',
          target: `قابلیت استعلام — ${String(warehouse.name)} (شناسهٔ ${input.warehouseId})`,
          details: `فعال‌شده: ${enabled}، غیرفعال‌شده: ${disabled}، شناسه کالاها: ${changedIds.join(',')}`,
        },
      })
    }

    if (started) await commitTransaction(req)
    return { enabled, disabled }
  } catch (error) {
    if (started) await killTransaction(req)
    if (error instanceof APIError && error.isPublic) throw error
    let cause: unknown = error
    for (let depth = 0; depth < 5 && cause && typeof cause === 'object'; depth++) {
      if ('constraint' in cause && cause.constraint === 'warehouse_product_idx') {
        throw businessError('این ردیف هم‌زمان ایجاد شده است؛ صفحه را تازه کنید.', 'STALE_STOCK')
      }
      cause = 'cause' in cause ? cause.cause : undefined
    }
    throw error
  }
}

export const boardEndpoints: Endpoint[] = [
  {
    path: '/board',
    method: 'get',
    handler: async req => {
      if (!await manageWarehouses({ req })) throw businessError('دسترسی مجاز نیست.', 'FORBIDDEN', 403)
      const query = req.url ? parseBoardQuery(new URL(req.url, 'http://localhost').searchParams) : null
      if (!query) return Response.json({ error: 'پارامترهای جستجو نامعتبر است.' }, { status: 400 })
      return Response.json(await readStockBoard(req, query), {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    },
  },
  {
    path: '/inquiry',
    method: 'post',
    handler: async req => Response.json(await updateInquiry(req, await req.json?.().catch(() => undefined))),
  },
]
