import { createHmac, timingSafeEqual } from 'node:crypto'
import { initTransaction, commitTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { StockImportPreviewInputSchema, StockImportApplyInputSchema, StockImportSnapshotSchema, type StockImportRow } from '@persianpart/contract'
import { manageWarehouses } from '../warehouses/warehouses.collection'
import { getOrderTransaction } from '../orders/_transaction'
import { replaceWarehouseStock } from './_stock-operations'
import { parseImportCsv } from './_import-csv'

const message = (error: unknown, fallback: string): string => error instanceof Error && error.constructor === Error && /[\u0600-\u06ff]/.test(error.message) ? error.message : fallback
const sign = (req: PayloadRequest, text: string) => createHmac('sha256', req.payload.secret).update(text).digest('hex')

// Retained for existing callers that need strict stock-only parsing.
export function parseStockCsv(csv: string): Array<{ sku: string; inventorySqm: number }> {
  const result = parseImportCsv(csv, 'stock')
  if (result.errors.length) throw new Error(result.errors[0]?.message)
  return result.rows.map(row => ({ sku: row.sku, inventorySqm: row.inventorySqm! }))
}

export const stockImportEndpoints: Endpoint[] = [
  { path: '/preview', method: 'post', handler: async req => {
    if (!await manageWarehouses({ req })) return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    try {
      const input = StockImportPreviewInputSchema.parse(await req.json?.())
      if (input.mode !== 'price') {
        const warehouse = await req.payload.findByID({ collection: 'warehouses', id: input.warehouseId!, depth: 0, req, overrideAccess: false })
        if (!warehouse.isActive || warehouse.stockMode !== 'exact') throw new Error('انبار قطعی فعال نیست.')
      }
      const parsed = parseImportCsv(input.csv, input.mode)
      const products = parsed.rows.length ? await req.payload.find({ collection: 'products', where: { sku: { in: parsed.rows.map(row => row.sku) } }, pagination: false, depth: 0, req, overrideAccess: false }) : { docs: [] }
      const bySku = new Map(products.docs.map(product => [product.sku, product]))
      const balances = input.mode !== 'price' && products.docs.length ? await req.payload.find({ collection: 'warehouse-stock', select: { product: true, inventorySqm: true, revision: true }, where: { and: [{ warehouse: { equals: input.warehouseId } }, { product: { in: products.docs.map(doc => doc.id) } }] }, pagination: false, depth: 0, req, overrideAccess: false }) : { docs: [] }
      const byProduct = new Map(balances.docs.map(balance => [typeof balance.product === 'object' ? balance.product.id : balance.product, balance]))
      const rows: StockImportRow[] = []
      for (const record of parsed.rows) {
        const product = bySku.get(record.sku)
        if (!product) { parsed.errors.push({ rowNumber: record.rowNumber, sku: record.sku, message: 'کد کالا در سایت یافت نشد.' }); continue }
        const balance = byProduct.get(product.id)
        rows.push({ ...record, productId: product.id, productUpdatedAt: product.updatedAt, name: product.name, revision: balance?.revision ?? null, previousInventory: balance?.inventorySqm ?? null, previousPrice: product.basePricePerSqm ?? null })
      }
      parsed.errors.sort((a, b) => a.rowNumber - b.rowNumber)
      let token: string | null = null
      if (rows.length) {
        const snapshot = StockImportSnapshotSchema.parse({ mode: input.mode, warehouseId: input.mode === 'price' ? undefined : input.warehouseId, actorId: req.user?.id, expiresAt: Date.now() + 15 * 60_000, rows })
        const body = Buffer.from(JSON.stringify(snapshot)).toString('base64url')
        token = `${body}.${sign(req, body)}`
      }
      return Response.json({ rows, errors: parsed.errors, total: parsed.total, token, priceChanges: rows.filter(row => row.basePricePerSqm !== undefined && row.basePricePerSqm !== row.previousPrice).length, stockChanges: rows.filter(row => row.inventorySqm !== undefined && row.inventorySqm !== row.previousInventory).length })
    } catch (error) { return Response.json({ error: message(error, 'فایل یا انبار معتبر نیست؛ ورودی‌ها را بررسی کنید.') }, { status: 400 }) }
  } },
  { path: '/apply', method: 'post', handler: async req => {
    if (!await manageWarehouses({ req })) return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    let started = false
    try {
      const { token } = StockImportApplyInputSchema.parse(await req.json?.())
      const [body, signature, extra] = token.split('.')
      if (!body || !signature || extra || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(req, body)))) throw new Error('پیش‌نمایش معتبر نیست.')
      const snapshot = StockImportSnapshotSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString()))
      if (snapshot.expiresAt < Date.now() || snapshot.actorId !== req.user?.id) throw new Error('پیش‌نمایش منقضی یا متعلق به کاربر دیگری است.')
      started = await initTransaction(req)
      const db = await getOrderTransaction(req)
      if (snapshot.warehouseId) {
        const warehouse = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${snapshot.warehouseId} AND is_active = true AND stock_mode = 'exact' FOR SHARE`)
        if (warehouse.rows.length !== 1) throw new Error('انبار فعال نیست.')
      }
      for (const row of [...snapshot.rows].sort((a, b) => a.productId - b.productId)) {
        const product = await db.execute(sql`SELECT updated_at FROM products WHERE id = ${row.productId} FOR UPDATE`)
        if (product.rows.length !== 1 || new Date(String(product.rows[0]?.updated_at)).getTime() !== new Date(row.productUpdatedAt).getTime()) throw new Error('اطلاعات کالا تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.')
        if (row.basePricePerSqm !== undefined && row.basePricePerSqm !== row.previousPrice) {
          await req.payload.update({ collection: 'products', id: row.productId, data: { basePricePerSqm: row.basePricePerSqm }, req, overrideAccess: false })
        }
        if (row.inventorySqm !== undefined && snapshot.warehouseId) {
          if (row.revision === null) await req.payload.create({ collection: 'warehouse-stock', data: { warehouse: snapshot.warehouseId, product: row.productId, inventorySqm: row.inventorySqm, revision: 0 }, req, overrideAccess: false })
          else await replaceWarehouseStock(req, snapshot.warehouseId, row.productId, row.inventorySqm, row.revision)
        }
      }
      await req.payload.create({ collection: 'audit-logs', data: { action: 'other', entity: 'products', target: snapshot.warehouseId ? `موجودی انبار #${snapshot.warehouseId}` : 'ورود قیمت کالاها', details: `نوع ${snapshot.mode}، ${snapshot.rows.length} ردیف`, admin: Number(req.user!.id), adminName: 'name' in req.user! ? String(req.user!.name) : '' }, req })
      if (started) await commitTransaction(req)
      return Response.json({ updated: snapshot.rows.length })
    } catch (error) {
      if (started) await killTransaction(req)
      return Response.json({ error: message(error, 'اعمال تغییرات ممکن نشد؛ پیش‌نمایش را دوباره دریافت کنید.') }, { status: 409 })
    }
  } },
  { path: '/export', method: 'get', handler: async req => {
    if (!await manageWarehouses({ req })) return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    const params = new URL(req.url!).searchParams
    const mode = params.get('mode') ?? 'price'
    if (mode !== 'price') return Response.json({ error: 'نوع خروجی معتبر نیست.' }, { status: 400 })
    const page = Number(params.get('page') ?? 1)
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) return Response.json({ error: 'شماره صفحه معتبر نیست.' }, { status: 400 })
    const escape = (text: string) => `"${text.replaceAll('"', '""')}"`
    const result = await req.payload.find({ collection: 'products', select: { sku: true, basePricePerSqm: true }, limit: 1000, page, sort: 'id', depth: 0, req, overrideAccess: false })
    const rows = result.docs.map(doc => `${escape(doc.sku)},${doc.basePricePerSqm ?? 0}`)
    return new Response(['sku,basePricePerSqm', ...rows].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="price-export.csv"` } })
  } },
]
