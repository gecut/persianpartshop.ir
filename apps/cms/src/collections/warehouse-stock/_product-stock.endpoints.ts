import { sql } from '@payloadcms/db-postgres'
import { APIError, commitTransaction, initTransaction, killTransaction, type Endpoint } from 'payload'
import { z } from 'zod'
import { businessError } from '../../lib/validation'
import { getOrderTransaction } from '../orders/_transaction'
import { getSalesFactor } from '../products/_inventory-math'
import { manageWarehouses, readWarehouseStock } from '../warehouses/warehouses.collection'
import { replaceWarehouseStock } from './_stock-operations'

const idSchema = z.number().int().positive().safe()
const amountSchema = z.number().nonnegative().refine(amount => {
  const scaled = amount * 100
  return Number.isSafeInteger(Math.round(scaled)) && Math.abs(scaled - Math.round(scaled)) <= 1e-7
})
const adjustmentSchema = z.object({
  warehouseId: idSchema,
  revision: z.number().int().nonnegative().safe().nullable(),
  amount: amountSchema.nullable(),
}).strict()

const path = '/for-product/:productId'

export const productStockEndpoints: Endpoint[] = [
  { path, method: 'get', handler: async req => {
    if (!await readWarehouseStock({ req })) throw businessError('دسترسی مجاز نیست.', 'FORBIDDEN', 403)
    const productId = idSchema.safeParse(Number(req.routeParams?.productId))
    if (!productId.success) throw businessError('شناسهٔ محصول نامعتبر است.', 'INVALID_PRODUCT', 400)
    const [product, warehouses, balances, canEdit] = await Promise.all([
      req.payload.findByID({ collection: 'products', id: productId.data, depth: 0, select: { productType: true, unit: true, sqmPerCarton: true }, req, overrideAccess: false }),
      req.payload.find({ collection: 'warehouses', depth: 0, pagination: false, sort: ['name', 'id'], select: { name: true, isActive: true, stockMode: true }, req, overrideAccess: false }),
      req.payload.find({
        collection: 'warehouse-stock', where: { product: { equals: productId.data } }, depth: 0, pagination: false,
        select: { warehouse: true, inventorySqm: true, revision: true, isActive: true, lastReportedAt: true }, req, overrideAccess: false,
      }),
      manageWarehouses({ req }),
    ])
    const byWarehouse = new Map(balances.docs.map(balance => [balance.warehouse, balance]))
    return Response.json({
      canEdit, productType: product.productType, unit: product.unit,
      salesFactor: getSalesFactor(product),
      rows: warehouses.docs.map(warehouse => {
        const balance = byWarehouse.get(warehouse.id)
        return {
          warehouse,
          balance: balance ? {
            amount: balance.inventorySqm ?? null, revision: balance.revision,
            isActive: balance.isActive, lastReportedAt: balance.lastReportedAt,
          } : null,
        }
      }),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } },
  { path, method: 'post', handler: async req => {
    if (!await manageWarehouses({ req }) || !req.user) throw businessError('دسترسی مجاز نیست.', 'FORBIDDEN', 403)
    const productId = idSchema.safeParse(Number(req.routeParams?.productId))
    const input = adjustmentSchema.safeParse(await req.json?.().catch(() => undefined))
    if (!productId.success || !input.success) throw businessError('مقدار موجودی یا شناسه نامعتبر است. مقدار باید نامنفی و دارای حداکثر دو رقم اعشار باشد.', 'INVALID_STOCK', 400)
    const { warehouseId, revision, amount } = input.data
    const started = await initTransaction(req)
    try {
      const db = await getOrderTransaction(req)
      const { rows: [warehouse] } = await db.execute(sql`
        SELECT name, stock_mode FROM warehouses WHERE id = ${warehouseId} AND is_active = true FOR SHARE
      `)
      if (!warehouse) throw businessError('انبار فعال نیست.', 'WAREHOUSE_UNAVAILABLE')
      const { rows: [product] } = await db.execute(sql`
        SELECT name, sku FROM products WHERE id = ${productId.data} FOR NO KEY UPDATE
      `)
      if (!product) throw businessError('محصول پیدا نشد.', 'PRODUCT_NOT_FOUND', 404)
      const { rows: [balance] } = await db.execute(sql`
        SELECT inventory_sqm, revision, is_active FROM warehouse_stock
        WHERE product_id = ${productId.data} AND warehouse_id = ${warehouseId} FOR UPDATE
      `)
      const exact = warehouse.stock_mode === 'exact'
      const stale = () => businessError('موجودی تغییر کرده است. مقدار تازه را بررسی و دوباره تأیید کنید.', 'STALE_STOCK')
      if (balance ? revision !== Number(balance.revision) : revision !== null) throw stale()
      if ((exact && amount === null) || (!exact && amount !== null)) {
        throw businessError('مقدار واردشده با نوع انبار سازگار نیست.', 'INVALID_STOCK', 400)
      }
      if (!balance) {
        await req.payload.create({
          collection: 'warehouse-stock', req, overrideAccess: false,
          data: { product: productId.data, warehouse: warehouseId, inventorySqm: amount, revision: 0, isActive: true },
        })
      } else {
        if (!balance.is_active || !exact || amount === null || revision === null) {
          throw businessError('اصلاح فقط برای ردیف فعال در انبار قطعی فعال مجاز است.', 'STOCK_UNAVAILABLE')
        }
        await replaceWarehouseStock(req, warehouseId, productId.data, amount, revision)
      }
      const previous = balance ? String(balance.inventory_sqm) : 'بدون رکورد'
      await req.payload.create({
        collection: 'audit-logs', req, overrideAccess: true,
        data: {
          action: 'other', entity: 'products', admin: Number(req.user.id),
          adminName: 'name' in req.user ? String(req.user.name) : '',
          target: `${product.name} (${product.sku}، شناسهٔ ${productId.data})`,
          details: `موجودی انبار ${warehouse.name} (شناسهٔ ${warehouseId})، مقدار قبل: ${previous}، مقدار جدید: ${amount ?? 'حضور استعلامی'}`,
        },
      })
      if (started) await commitTransaction(req)
      return Response.json({ updated: true })
    } catch (error) {
      if (started) await killTransaction(req)
      if (error instanceof APIError && error.isPublic) throw error
      let cause: unknown = error
      for (let depth = 0; depth < 5 && cause && typeof cause === 'object'; depth++) {
        if ('constraint' in cause && cause.constraint === 'warehouse_product_idx') {
          throw businessError('این محصول به انبار اضافه شده است. فهرست را دوباره بررسی کنید.', 'STALE_STOCK')
        }
        cause = 'cause' in cause ? cause.cause : undefined
      }
      throw error
    }
  } },
]
