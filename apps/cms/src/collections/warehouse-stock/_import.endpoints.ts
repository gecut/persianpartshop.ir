import { createHmac, timingSafeEqual } from 'node:crypto'
import { parse } from 'csv-parse/sync'
import { initTransaction, commitTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { StockImportPreviewInputSchema, StockImportApplyInputSchema, StockImportSnapshotSchema, type StockImportRow } from '@persianpart/contract'
import { manageWarehouses } from '../warehouses/warehouses.collection'
import { getOrderTransaction } from '../orders/_transaction'
import { replaceWarehouseStock } from './_stock-operations'

const message = (error: unknown, fallback: string): string => error instanceof Error && error.constructor === Error && /[\u0600-\u06ff]/.test(error.message) ? error.message : fallback

const sign = (req: PayloadRequest, text: string) => createHmac('sha256', req.payload.secret).update(text).digest('hex')
export function parseStockCsv(csv: string): Array<{ sku: string; inventorySqm: number }> {
  const raw: unknown = parse(csv, { columns: (headers: string[]) => { if (headers.length !== 2 || [...headers].sort().join(',') !== 'inventorySqm,sku') throw new Error('ستون‌های فایل باید دقیقاً sku و inventorySqm باشند.'); return headers }, bom: true, skip_empty_lines: true, trim: true, max_record_size: 10000 })
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 1000) throw new Error('فایل باید بین یک تا هزار ردیف داشته باشد.')
  const seen = new Set<string>()
  return raw.map((row: unknown) => {
    if (!row || typeof row !== 'object' || Object.keys(row).sort().join(',') !== 'inventorySqm,sku' || !('sku' in row) || typeof row.sku !== 'string' || !row.sku || !('inventorySqm' in row) || typeof row.inventorySqm !== 'string' || !/^\d+(\.\d{1,2})?$/.test(row.inventorySqm)) throw new Error('ستون‌های فایل باید دقیقاً sku و inventorySqm باشند؛ موجودی نامنفی با حداکثر دو رقم اعشار است.')
    if (seen.has(row.sku)) throw new Error(`کد کالای تکراری: ${row.sku}`)
    seen.add(row.sku)
    const inventorySqm = Number(row.inventorySqm)
    if (!Number.isFinite(inventorySqm) || inventorySqm > 1_000_000_000) throw new Error('موجودی بیش از حد مجاز است.')
    return { sku: row.sku, inventorySqm }
  })
}

export const stockImportEndpoints: Endpoint[] = [
  { path: '/preview', method: 'post', handler: async req => {
    if (!await manageWarehouses({ req })) return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    try {
      const input = StockImportPreviewInputSchema.parse(await req.json?.())
      const warehouse = await req.payload.findByID({ collection: 'warehouses', id: input.warehouseId, depth: 0, req, overrideAccess: false })
      if (!warehouse.isActive) throw new Error('انبار فعال نیست.')
      const records = parseStockCsv(input.csv)
      const products = await req.payload.find({ collection: 'products', where: { sku: { in: records.map(row => row.sku) } }, pagination: false, depth: 0, req, overrideAccess: false })
      const balances = await req.payload.find({ collection: 'warehouse-stock', select: { product: true, warehouse: true, inventorySqm: true, revision: true }, where: { and: [{ warehouse: { equals: warehouse.id } }, { product: { in: products.docs.map(doc => doc.id) } }] }, pagination: false, depth: 0, req, overrideAccess: false })
      const rows: StockImportRow[] = records.map(record => {
        const product = products.docs.find(doc => doc.sku === record.sku)
        if (!product) throw new Error(`کد کالا شناخته‌شده نیست: ${record.sku}`)
        const balance = balances.docs.find(doc => (typeof doc.product === 'object' ? doc.product.id : doc.product) === product.id)
        return { ...record, productId: product.id, productUpdatedAt: product.updatedAt, revision: balance?.revision ?? null }
      })
      const snapshot = StockImportSnapshotSchema.parse({ warehouseId: warehouse.id, actorId: req.user?.id, expiresAt: Date.now() + 15 * 60_000, rows })
      const body = Buffer.from(JSON.stringify(snapshot)).toString('base64url')
      return Response.json({ rows, token: `${body}.${sign(req, body)}` })
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
      const warehouse = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${snapshot.warehouseId} AND is_active = true FOR SHARE`)
      if (warehouse.rows.length !== 1) throw new Error('انبار فعال نیست.')
      for (const row of [...snapshot.rows].sort((a, b) => a.productId - b.productId)) {
        const product = await db.execute(sql`SELECT updated_at FROM products WHERE id = ${row.productId} FOR SHARE`)
        if (product.rows.length !== 1 || new Date(String(product.rows[0]?.updated_at)).getTime() !== new Date(row.productUpdatedAt).getTime()) throw new Error('اطلاعات کالا تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.')
        if (row.revision === null) {
          await req.payload.create({ collection: 'warehouse-stock', data: { warehouse: snapshot.warehouseId, product: row.productId, inventorySqm: row.inventorySqm, revision: 0 }, req, overrideAccess: false })
        } else await replaceWarehouseStock(req, snapshot.warehouseId, row.productId, row.inventorySqm, row.revision)
      }
      await req.payload.create({ collection: 'audit-logs', data: { action: 'other', entity: 'products', target: `موجودی انبار #${snapshot.warehouseId}`, details: `اعمال CSV موجودی: ${snapshot.rows.length} ردیف`, admin: Number(req.user!.id), adminName: 'name' in req.user! ? String(req.user!.name) : '' }, req })
      if (started) await commitTransaction(req)
      req.payload.logger.info({ actorId: req.user?.id, warehouseId: snapshot.warehouseId, rows: snapshot.rows.length }, 'Warehouse inventory imported')
      return Response.json({ updated: snapshot.rows.length })
    } catch (error) {
      if (started) await killTransaction(req)
      return Response.json({ error: message(error, 'اعمال موجودی ممکن نشد؛ پیش‌نمایش را دوباره دریافت کنید.') }, { status: 409 })
    }
  } },
  { path: '/export', method: 'get', handler: async req => {
    if (!await manageWarehouses({ req })) return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    const warehouseId = Number(new URL(req.url!).searchParams.get('warehouseId'))
    if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) return Response.json({ error: 'انبار را انتخاب کنید.' }, { status: 400 })
    const result = await req.payload.find({ collection: 'warehouse-stock', where: { warehouse: { equals: warehouseId } }, pagination: false, depth: 1, req, overrideAccess: false })
    const escape = (text: string) => `"${text.replaceAll('"', '""')}"`
    const rows = result.docs.map(doc => `${escape(typeof doc.product === 'object' ? doc.product.sku : String(doc.product))},${doc.inventorySqm}`)
    return new Response(['sku,inventorySqm', ...rows].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="warehouse-stock.csv"' } })
  } },
]
