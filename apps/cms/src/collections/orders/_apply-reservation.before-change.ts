import type { CollectionBeforeChangeHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getOrderTransaction } from './_transaction'

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
      throw new Error('Order status changed. Reload the order before updating.')
    }
  }

  // Reservation on Order Create:
  // inventory_sqm is authoritative. stock_cartons is derived as FLOOR(new_inventory_sqm / sqm_per_carton).
  if (operation === 'create' && Array.isArray(data.items)) {
    const items = reservationItems(data.items)
    for (const { productId, cartonCount, deliverableArea } of items) {
      const result = await db.execute(sql`
        UPDATE "products"
        SET
          "inventory_sqm" = ROUND(("inventory_sqm" - ${deliverableArea})::numeric, 2),
          "stock_cartons" = FLOOR(ROUND(("inventory_sqm" - ${deliverableArea})::numeric, 2) / "sqm_per_carton"),
          "updated_at" = NOW()
        WHERE "id" = ${productId}
          AND "inventory_sqm" >= ${deliverableArea}
          AND FLOOR(ROUND(("inventory_sqm" - ${deliverableArea})::numeric, 2) / "sqm_per_carton") >= 0
        RETURNING "id", "name", "stock_cartons", "inventory_sqm"
      `)

      if (result.rows.length !== 1) {
        const current = await req.payload.findByID({
          collection: 'products',
          id: productId,
          depth: 0,
          req,
        })
        const cCartons = current?.stockCartons ?? 0
        const cSqm = current?.inventorySqm ?? 0
        throw new Error(
          `موجودی ناکافی برای محصول ${current?.name || productId}. موجودی: ${cCartons} کارتن (${cSqm} م²)، درخواستی: ${cartonCount} کارتن (${deliverableArea} م²)`
        )
      }
    }
  }

  // Inventory Restoration on Order Cancel:
  // inventory_sqm is incremented by deliverableArea, and stock_cartons is re-derived as FLOOR(new_inventory_sqm / sqm_per_carton).
  if (
    operation === 'update' &&
    originalDoc &&
    data.status &&
    isCancelledStatus(data.status) &&
    !isCancelledStatus(originalDoc.status)
  ) {
    if (originalDoc.status !== 'pending' && originalDoc.status !== 'approve') {
      throw new Error(`سفارش در وضعیت '${originalDoc.status}' قابل لغو نیست.`)
    }

    const items = reservationItems(originalDoc.items)
    for (const { productId, cartonCount, deliverableArea } of items) {
      const result = await db.execute(sql`
        UPDATE "products"
        SET
          "inventory_sqm" = ROUND(("inventory_sqm" + ${deliverableArea})::numeric, 2),
          "stock_cartons" = FLOOR(ROUND(("inventory_sqm" + ${deliverableArea})::numeric, 2) / "sqm_per_carton"),
          "updated_at" = NOW()
        WHERE "id" = ${productId}
        RETURNING "id"
      `)
      if (result.rows.length !== 1) {
        throw new Error(`محصول با شناسه ${productId} در هنگام رزرو موجودی یافت نشد.`)
      }
    }
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
