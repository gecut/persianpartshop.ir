import { businessError } from '../../lib/validation'
import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { getOrderTransaction } from '../orders/_transaction'

export interface StockRequirement { productId: number; deliverableArea: number }

const validId = (id: number): void => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('شناسه نامعتبر است.')
}

const validAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || amount < 0 ||
    !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw new Error('مقدار موجودی نامعتبر است.')
  }
}

export function consolidateRequirements(items: readonly StockRequirement[]): StockRequirement[] {
  if (!items.length) throw new Error('سبد خالی است.')
  const totals = new Map<number, number>()
  for (const item of items) {
    validId(item.productId)
    validAmount(item.deliverableArea)
    if (item.deliverableArea === 0) throw new Error('مقدار باید مثبت باشد.')
    const hundredths = (totals.get(item.productId) ?? 0) + Math.round(item.deliverableArea * 100)
    if (!Number.isSafeInteger(hundredths)) throw new Error('مقدار بیش از حد مجاز است.')
    totals.set(item.productId, hundredths)
  }
  return [...totals].sort(([a], [b]) => a - b).map(([productId, amount]) => ({ productId, deliverableArea: amount / 100 }))
}

// Caller owns the transaction and must roll it back on any error.
export async function reserveWarehouseStock(req: PayloadRequest, warehouseId: number, requirements: readonly StockRequirement[]): Promise<void> {
  validId(warehouseId)
  const items = consolidateRequirements(requirements)
  const db = await getOrderTransaction(req)
  const warehouse = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'exact' FOR SHARE`)
  if (warehouse.rows.length !== 1) throw businessError('انبار انتخاب‌شده فعال نیست.', 'WAREHOUSE_UNAVAILABLE')
  for (const item of items) {
    const result = await db.execute(sql`
      UPDATE warehouse_stock SET inventory_sqm = inventory_sqm - ${item.deliverableArea}, revision = revision + 1, updated_at = NOW()
      WHERE warehouse_id = ${warehouseId} AND product_id = ${item.productId} AND is_active = true AND inventory_sqm >= ${item.deliverableArea}
      RETURNING id
    `)
    if (result.rows.length !== 1) throw businessError('موجودی فعال انبار برای تأمین سفارش کافی نیست.', 'INSUFFICIENT_STOCK')
  }
}

// Cancellation must lock the order and verify its transition before calling this.
export async function restoreWarehouseStock(req: PayloadRequest, warehouseId: number, requirements: readonly StockRequirement[]): Promise<void> {
  validId(warehouseId)
  const items = consolidateRequirements(requirements)
  const db = await getOrderTransaction(req)
  for (const item of items) {
    const result = await db.execute(sql`
      UPDATE warehouse_stock SET inventory_sqm = inventory_sqm + ${item.deliverableArea}, revision = revision + 1, updated_at = NOW()
      WHERE warehouse_id = ${warehouseId} AND product_id = ${item.productId} RETURNING id
    `)
    if (result.rows.length !== 1) throw new Error('رکورد موجودی سفارش یافت نشد.')
  }
}

export async function replaceWarehouseStock(req: PayloadRequest, warehouseId: number, productId: number, inventorySqm: number, revision: number): Promise<void> {
  validId(warehouseId)
  validId(productId)
  validAmount(inventorySqm)
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('نسخهٔ موجودی نامعتبر است.')
  const db = await getOrderTransaction(req)
  const warehouse = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'exact' FOR SHARE`)
  if (warehouse.rows.length !== 1) throw businessError('انبار قطعی فعال نیست.', 'WAREHOUSE_UNAVAILABLE')
  const result = await db.execute(sql`
    UPDATE warehouse_stock SET inventory_sqm = ${inventorySqm}, revision = revision + 1, updated_at = NOW()
    WHERE warehouse_id = ${warehouseId} AND product_id = ${productId} AND revision = ${revision} RETURNING id
  `)
  if (result.rows.length !== 1) throw businessError('موجودی تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.', 'STALE_STOCK')
}
