import { sendAfterCommit } from '../../lib/committed-sms'
import { businessError, fieldError } from '../../lib/validation'
import { nextTrackingNumber } from '../../lib/tracking-number'
import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { CollectionConfig } from 'payload'
import { getAdminUser, isSalesManager } from '../../access/roles'
import { sendSmsNotification } from '../../lib/sms'
import { getOrderTransaction } from '../orders/_transaction'
import { calculateSupplyEstimate, getSalesFactor } from '../products/_inventory-math'

const idOf = (value: unknown): number => Number(typeof value === 'object' && value !== null && 'id' in value ? (value as { id: unknown }).id : value)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const supplyKeyHash = (userId: number, key: string) => hash(`${userId}:${key}`)
export const supplyFingerprintV1 = (productId: number, warehouseId: number, quantity: number, notes: string) => hash(JSON.stringify([productId, warehouseId, quantity, notes.trim()]))
export const supplyFingerprintV2 = (productId: number, quantity: number, notes: string) => hash(JSON.stringify([productId, quantity, notes.trim()]))
export const supplyFingerprint = supplyFingerprintV1

export const SupplyRequests: CollectionConfig = {
  slug: 'supply-requests',
  labels: { singular: 'درخواست تأمین', plural: 'درخواست‌های تأمین' },
  admin: { group: 'فروش و مشتریان', useAsTitle: 'trackingNumber', defaultColumns: ['trackingNumber', 'user', 'status', 'responseDueAt'] },
  access: {
    read: isSalesManager,
    create: ({ req }) => getAdminUser(req.user)?.role === 'service',
    update: isSalesManager,
    delete: () => false,
  },
  hooks: {
    beforeOperation: [async ({ args, operation, req }) => {
      if (operation !== 'update') return
      if (!('id' in args)) throw businessError('ویرایش گروهی درخواست مجاز نیست.')
      const id = Number(args.id)
      if (!Number.isSafeInteger(id) || id <= 0) throw businessError('شناسه درخواست نامعتبر است.')
      const db = await getOrderTransaction(req)
      await db.execute(sql`SELECT id FROM supply_requests WHERE id = ${id} FOR UPDATE`)
    }],
    beforeValidate: [async ({ data, originalDoc, operation, req }) => {
      if (!data) return data
      const actor = getAdminUser(req.user)
      if (operation === 'update') {
        if (!actor || !['service', 'support', 'manager', 'superadmin'].includes(actor.role)) throw businessError('دسترسی مجاز نیست.')
        const relations = new Set(['user', 'product', 'warehouse'])
        const equal = (key: string) => relations.has(key) ? (data[key] == null && originalDoc[key] == null) || idOf(data[key]) === idOf(originalDoc[key]) : (data[key] ?? null) === (originalDoc[key] ?? null)
        if (Object.keys(data).some(key => key !== 'status' && !equal(key))) throw businessError('فقط وضعیت درخواست قابل تغییر است.')
        const next = data.status ?? originalDoc.status
        if (originalDoc.status === 'cancelled_by_customer' && next !== originalDoc.status) throw businessError('درخواست لغوشده قابل بازگشایی نیست.')
        if (actor.role === 'service') {
          if (next !== 'cancelled_by_customer') throw businessError('تغییر وضعیت مجاز نیست.')
          if (originalDoc.status !== 'cancelled_by_customer' && (originalDoc.status !== 'new' || originalDoc.reviewStartedAt)) throw businessError('این درخواست در وضعیت فعلی قابل لغو نیست.', 'CANNOT_CANCEL', 409)
          data.cancelledAt = originalDoc.cancelledAt ?? new Date().toISOString()
        } else {
          if (next === 'cancelled_by_customer' && originalDoc.status !== next) throw businessError('لغو فقط توسط مشتری مجاز است.')
          if (next !== originalDoc.status) {
            if (!originalDoc.reviewStartedAt) data.reviewStartedAt = new Date().toISOString()
            data.resolvedAt = next === 'supplied' || next === 'unavailable' ? new Date().toISOString() : null
          }
        }
        return data
      }
      if (actor?.role !== 'service') throw businessError('دسترسی مجاز نیست.')
      const allowed = new Set(['user', 'product', 'warehouse', 'requestedQuantity', 'notes', 'idempotencyKey', 'status', 'fingerprintVersion'])
      if (Object.keys(data).some(key => !allowed.has(key) && data[key] != null) || (data.status != null && data.status !== 'new')) throw businessError('ورودی درخواست معتبر نیست.')
      const userId = idOf(data.user), productId = idOf(data.product)
      const rawWarehouse = data.warehouse != null ? idOf(data.warehouse) : null
      const warehouseId = Number.isSafeInteger(rawWarehouse) && rawWarehouse! > 0 ? rawWarehouse : null
      if (![userId, productId].every(id => Number.isSafeInteger(id) && id > 0)) throw businessError('ورودی درخواست معتبر نیست.')
      const key = String(data.idempotencyKey ?? '')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw businessError('کلید درخواست معتبر نیست.')
      const notes = typeof data.notes === 'string' ? data.notes.trim() : ''
      if (notes.length > 2000) throw businessError('یادداشت بیش از حد طولانی است.')
      const db = await getOrderTransaction(req)

      let selectedWarehouse: { name: string; code: string } | null = null
      if (warehouseId !== null) {
        const lockedWarehouse = await db.execute(sql`SELECT id, name, code FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'inquiry' FOR SHARE`)
        if (!lockedWarehouse.rows.length) throw businessError('منبع تأمین انتخاب‌شده در دسترس نیست.', 'SOURCE_UNAVAILABLE', 409)
        selectedWarehouse = lockedWarehouse.rows[0] as { name: string; code: string }
        const sourceCheck = await db.execute(sql`SELECT id FROM warehouse_stock WHERE product_id = ${productId} AND warehouse_id = ${warehouseId} AND is_active = true FOR SHARE`)
        if (!sourceCheck.rows.length) throw businessError('منبع تأمین انتخاب‌شده در دسترس نیست.', 'SOURCE_UNAVAILABLE', 409)
      } else {
        const sourceCheck = await db.execute(sql`
          SELECT ws.id 
          FROM warehouse_stock ws 
          JOIN warehouses w ON w.id = ws.warehouse_id 
          WHERE ws.product_id = ${productId} 
            AND w.is_active = true 
            AND w.stock_mode = 'inquiry' 
            AND ws.is_active = true 
          LIMIT 1 FOR SHARE
        `)
        if (!sourceCheck.rows.length) throw businessError('منبع تأمین انتخاب‌شده در دسترس نیست.', 'SOURCE_UNAVAILABLE', 409)
      }

      await db.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR SHARE`)
      const user = await req.payload.findByID({ collection: 'users', id: userId, depth: 1, req })
      const product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0, req })
      if (user.status !== 'active' || user.disableOrdering || user.hideExactStock) throw businessError('اجازهٔ ثبت این درخواست را ندارید.', 'FORBIDDEN', 403)
      if (!product.isActive) throw businessError('منبع تأمین انتخاب‌شده در دسترس نیست.', 'SOURCE_UNAVAILABLE', 409)
      const categories = (user.allowedCategories ?? []).map(idOf)
      if (categories.length && !categories.includes(idOf(product.category))) throw businessError('اجازهٔ ثبت این درخواست را ندارید.', 'FORBIDDEN', 403)
      const quantity = Number(data.requestedQuantity)
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 || Math.round(quantity * 100) < 1 || Math.abs(quantity * 100 - Math.round(quantity * 100)) > 1e-7) fieldError('requestedQuantity', 'مقدار باید مثبت، حداکثر یک میلیون و دارای حداکثر دو رقم اعشار باشد.')
      const factor = getSalesFactor(product)
      const markup = typeof user.customerType === 'object' && user.customerType !== null ? (user.customerType as { markupPercent?: number }).markupPercent ?? 0 : 0
      const quote = calculateSupplyEstimate({ requestedQuantity: Number(data.requestedQuantity), salesFactor: factor, basePrice: Number(product.basePricePerSqm ?? 0), markupPercent: markup })
      const available = await db.execute(sql`SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id = s.warehouse_id WHERE s.product_id = ${productId} AND s.is_active = true AND w.is_active = true AND w.stock_mode = 'exact' AND s.inventory_sqm >= ${quote.roundedQuantity} LIMIT 1`)
      if (available.rows.length) throw businessError('موجودی قطعی برای این مقدار وجود دارد؛ سفارش ثبت کنید.', 'EXACT_STOCK_AVAILABLE', 409)
      const imageId = product.cover ? idOf(product.cover) : product.gallery?.[0]?.image ? idOf(product.gallery[0].image) : null
      const image = imageId ? await req.payload.findByID({ collection: 'media', id: imageId, depth: 0, req }) : null
      const now = new Date()
      const isV2 = warehouseId === null

      data.trackingNumber = await nextTrackingNumber(req)
      data.requestNumber = String(data.trackingNumber)
      data.status = 'new'
      data.notes = notes
      data.idempotencyKey = supplyKeyHash(userId, key)
      data.fingerprintVersion = isV2 ? 2 : 1
      data.warehouse = isV2 ? null : warehouseId
      data.warehouseName = isV2 ? null : selectedWarehouse!.name
      data.warehouseCode = isV2 ? null : selectedWarehouse!.code
      data.requestFingerprint = isV2
        ? supplyFingerprintV2(productId, Number(data.requestedQuantity), notes)
        : supplyFingerprintV1(productId, warehouseId!, Number(data.requestedQuantity), notes)

      Object.assign(data, quote, {
        salesFactor: factor,
        productType: product.productType ?? 'tile',
        unit: product.productType === 'other' ? product.unit ?? 'piece' : 'm2',
        cartonsPerPallet: product.productType === 'other' ? null : product.cartonsPerPallet ?? null,
        productSku: product.sku,
        productName: product.name,
        productImage: image?.url ?? null,
        responseDueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        reviewStartedAt: null,
        resolvedAt: null,
        cancelledAt: null,
        createdAt: now.toISOString(),
      })
      return data
    }],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      if (operation !== 'update' || doc.status === previousDoc.status || !['supplied', 'unavailable'].includes(doc.status)) return
      try {
        const webUrl = process.env.WEB_URL?.replace(/\/+$/, '')
        if (!webUrl) { console.error('[SMS] Web URL is not configured'); return }
        const user = await req.payload.findByID({ collection: 'users', id: idOf(doc.user), depth: 0, req })
        if (user.phone) await sendAfterCommit(req, `supply:${doc.id}:${doc.status}`, async () => {
          await sendSmsNotification({ receptor: user.phone, message: `نتیجه درخواست ${doc.trackingNumber} ثبت شد. مشاهده: ${webUrl}/orders?view=supply&requestId=${doc.id}` })
        })
      } catch { console.error('[SMS] Supply notification failed') }
    }],
  },
  fields: [
    { name: 'trackingNumber', type: 'number', required: true, unique: true, label: 'شمارهٔ پیگیری', admin: { readOnly: true } },
    { name: 'requestNumber', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { readOnly: true } },
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true, admin: { readOnly: true } },
    { name: 'warehouse', type: 'relationship', relationTo: 'warehouses', required: false, index: true, admin: { readOnly: true } },
    { name: 'status', type: 'select', required: true, defaultValue: 'new', options: [{ label: 'ثبت‌شده', value: 'new' }, { label: 'در حال بررسی', value: 'reviewing' }, { label: 'تأمین شده', value: 'supplied' }, { label: 'غیرقابل تأمین', value: 'unavailable' }, { label: 'لغو توسط مشتری', value: 'cancelled_by_customer' }] },
    ...(['requestedQuantity', 'packageCount', 'roundedQuantity', 'salesFactor', 'estimatedUnitPrice', 'estimatedTotal'] as const).map(name => ({ name, type: 'number' as const, required: true, admin: { readOnly: true } })),
    { name: 'cartonsPerPallet', type: 'number', admin: { readOnly: true } },
    ...(['productType', 'unit', 'productSku', 'productName'] as const).map(name => ({ name, type: 'text' as const, required: true, admin: { readOnly: true } })),
    ...(['warehouseName', 'warehouseCode'] as const).map(name => ({ name, type: 'text' as const, required: false, admin: { readOnly: true } })),
    { name: 'productImage', type: 'text', admin: { readOnly: true } },
    { name: 'notes', type: 'textarea', defaultValue: '', maxLength: 2000, admin: { readOnly: true } },
    { name: 'responseDueAt', type: 'date', required: true, admin: { readOnly: true } },
    ...(['reviewStartedAt', 'resolvedAt', 'cancelledAt'] as const).map(name => ({ name, type: 'date' as const, admin: { readOnly: true } })),
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
    { name: 'requestFingerprint', type: 'text', required: true, admin: { hidden: true } },
    { name: 'fingerprintVersion', type: 'number', required: true, defaultValue: 1, admin: { hidden: true } },
  ],
}
