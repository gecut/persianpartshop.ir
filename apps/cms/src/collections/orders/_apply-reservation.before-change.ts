import { businessError } from '../../lib/validation'
import type { CollectionBeforeChangeHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getOrderTransaction } from './_transaction'
import { reserveWarehouseStock, restoreWarehouseStock } from '../warehouse-stock/_stock-operations'

const isCancelledStatus = (s?: string) =>
  s === 'cancel' ||
  s === 'cancelled' ||
  s === 'cancelled_by_customer' ||
  s === 'cancelled_by_admin'

const positiveNumber = (value: unknown, integer = false): number => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('Invalid inventory quantity or identifier.')
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isSafeInteger(number))) {
    throw new Error('Invalid inventory quantity or identifier.')
  }
  return number
}

const reservationItems = (items: unknown) => {
  if (!Array.isArray(items)) throw new Error('Invalid order inventory items.')
  return items.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('product' in item) ||
      !('cartonCount' in item) || !('deliverableArea' in item)) {
      throw new Error('Invalid order inventory items.')
    }
    const product = item.product
    const productId = positiveNumber(
      product && typeof product === 'object' && 'id' in product ? product.id : product,
      true,
    )
    return {
      productId,
      cartonCount: positiveNumber(item.cartonCount, true),
      deliverableArea: positiveNumber(item.deliverableArea),
    }
  }).sort((a, b) => a.productId - b.productId)
}

export const applyReservationBeforeChange: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data) return data

  const db = await getOrderTransaction(req)

  if (operation === 'update') {
    const orderId = positiveNumber(originalDoc?.id, true)
    const locked = await db.execute(sql`
      SELECT "status" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE
    `)
    const current = locked.rows[0]
    if (locked.rows.length !== 1 || current?.status !== originalDoc.status) {
      throw businessError('وضعیت سفارش تغییر کرده است؛ صفحه را دوباره دریافت کنید.', 'STALE_ORDER')
    }
  }

  // Reservation on Order Create:
  // Warehouse stock is authoritative.
  if (operation === 'create' && Array.isArray(data.items)) {
    const items = reservationItems(data.items)
    const warehouseId = positiveNumber(typeof data.warehouse === 'object' ? data.warehouse?.id : data.warehouse, true)
    await reserveWarehouseStock(req, warehouseId, items)
  }

  // Inventory Restoration on Order Cancel:
  // Restore only the original warehouse.
  if (
    operation === 'update' &&
    originalDoc &&
    data.status &&
    isCancelledStatus(data.status) &&
    !isCancelledStatus(originalDoc.status)
  ) {
    if (originalDoc.status !== 'pending' && originalDoc.status !== 'approve') {
      throw businessError(`سفارش در وضعیت '${originalDoc.status}' قابل لغو نیست.`)
    }

    const items = reservationItems(originalDoc.items)
    const warehouseId = positiveNumber(typeof originalDoc.warehouse === 'object' ? originalDoc.warehouse?.id : originalDoc.warehouse, true)
    await restoreWarehouseStock(req, warehouseId, items)
  }

  if (data.status === 'cancelled_by_customer') {
    data.cancelledBy = 'customer'
  } else if (data.status === 'cancelled_by_admin') {
    data.cancelledBy = 'admin'
  } else if (data.status === 'cancel') {
    if (data.cancelledBy === 'customer') {
      data.status = 'cancelled_by_customer'
    } else {
      data.status = 'cancelled_by_admin'
    }
  }

  return data
}
