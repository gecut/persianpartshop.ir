import { createHash, randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { getAdminUser, isSalesManager } from '../../access/roles'
import { sendSmsNotification } from '../../lib/sms'
import { getOrderTransaction } from '../orders/_transaction'
import { calculateSupplyEstimate, getSalesFactor } from '../products/_inventory-math'

const idOf = (value: unknown): number => Number(typeof value === 'object' && value !== null && 'id' in value ? value.id : value)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const supplyKeyHash = (userId: number, key: string) => hash(`${userId}:${key}`)
export const supplyFingerprint = (productId: number, warehouseId: number, quantity: number, notes: string) => hash(JSON.stringify([productId, warehouseId, quantity, notes.trim()]))

export const SupplyRequests: CollectionConfig = {
  slug: 'supply-requests',
  labels: { singular: 'درخواست تأمین', plural: 'درخواست‌های تأمین' },
  admin: { group: 'فروش و مشتریان', useAsTitle: 'requestNumber', defaultColumns: ['requestNumber', 'user', 'status', 'responseDueAt'] },
  access: {
    read: isSalesManager,
    create: ({ req }) => getAdminUser(req.user)?.role === 'service',
    update: isSalesManager,
    delete: () => false,
  },
  hooks: {
    beforeOperation: [async ({ args, operation, req }) => {
      if (operation !== 'update') return
      if (!('id' in args)) throw new Error('ویرایش گروهی درخواست مجاز نیست.')
      const id = Number(args.id)
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('شناسه درخواست نامعتبر است.')
      const db = await getOrderTransaction(req)
      await db.execute(sql`SELECT id FROM supply_requests WHERE id = ${id} FOR UPDATE`)
    }],
    beforeValidate: [async ({ data, originalDoc, operation, req }) => {
      if (!data) return data
      const actor = getAdminUser(req.user)
      if (operation === 'update') {
        if (!actor || !['service', 'support', 'manager', 'superadmin'].includes(actor.role)) throw new Error('دسترسی مجاز نیست.')
        const relations = new Set(['user', 'product', 'warehouse'])
        const equal = (key: string) => relations.has(key) ? idOf(data[key]) === idOf(originalDoc[key]) : (data[key] ?? null) === (originalDoc[key] ?? null)
        if (Object.keys(data).some(key => key !== 'status' && !equal(key))) throw new Error('فقط وضعیت درخواست قابل تغییر است.')
        const next = data.status ?? originalDoc.status
        if (originalDoc.status === 'cancelled_by_customer' && next !== originalDoc.status) throw new Error('درخواست لغوشده قابل بازگشایی نیست.')
        if (actor.role === 'service') {
          if (next !== 'cancelled_by_customer') throw new Error('تغییر وضعیت مجاز نیست.')
          if (originalDoc.status !== 'cancelled_by_customer' && (originalDoc.status !== 'new' || originalDoc.reviewStartedAt)) throw new APIError('CANNOT_CANCEL', 409, null, true)
          data.cancelledAt = originalDoc.cancelledAt ?? new Date().toISOString()
        } else {
          if (next === 'cancelled_by_customer' && originalDoc.status !== next) throw new Error('لغو فقط توسط مشتری مجاز است.')
          if (next !== originalDoc.status) {
            if (!originalDoc.reviewStartedAt) data.reviewStartedAt = new Date().toISOString()
            data.resolvedAt = next === 'supplied' || next === 'unavailable' ? new Date().toISOString() : null
          }
        }
        return data
      }
      if (actor?.role !== 'service') throw new Error('دسترسی مجاز نیست.')
      const allowed = new Set(['user', 'product', 'warehouse', 'requestedQuantity', 'notes', 'idempotencyKey', 'status'])
      if (Object.keys(data).some(key => !allowed.has(key) && data[key] != null) || (data.status != null && data.status !== 'new')) throw new Error('ورودی درخواست معتبر نیست.')
      const userId = idOf(data.user), productId = idOf(data.product), warehouseId = idOf(data.warehouse)
      if (![userId, productId, warehouseId].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('ورودی درخواست معتبر نیست.')
      const key = String(data.idempotencyKey ?? '')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new Error('کلید درخواست معتبر نیست.')
      const notes = typeof data.notes === 'string' ? data.notes.trim() : ''
      if (notes.length > 2000) throw new Error('یادداشت بیش از حد طولانی است.')
      const db = await getOrderTransaction(req)
      const locked = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'inquiry' FOR SHARE`)
      if (!locked.rows.length) throw new APIError('SOURCE_UNAVAILABLE', 409, null, true)
      await db.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR SHARE`)
      const user = await req.payload.findByID({ collection: 'users', id: userId, depth: 1, req })
      const product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0, req })
      const warehouse = await req.payload.findByID({ collection: 'warehouses', id: warehouseId, depth: 0, req })
      const sources = await req.payload.find({ collection: 'supply-sources', where: { and: [{ product: { equals: productId } }, { warehouse: { equals: warehouseId } }, { isActive: { equals: true } }] }, limit: 1, depth: 0, req })
      if (user.status !== 'active' || user.disableOrdering || user.hideExactStock) throw new APIError('FORBIDDEN', 403, null, true)
      if (!product.isActive || !sources.docs.length) throw new APIError('SOURCE_UNAVAILABLE', 409, null, true)
      const categories = (user.allowedCategories ?? []).map(idOf)
      if (categories.length && !categories.includes(idOf(product.category))) throw new APIError('FORBIDDEN', 403, null, true)
      const factor = getSalesFactor(product)
      const markup = typeof user.customerType === 'object' && user.customerType !== null ? user.customerType.markupPercent ?? 0 : 0
      const quote = calculateSupplyEstimate({ requestedQuantity: Number(data.requestedQuantity), salesFactor: factor, basePrice: Number(product.basePricePerSqm ?? 0), markupPercent: markup })
      const available = await db.execute(sql`SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id = s.warehouse_id WHERE s.product_id = ${productId} AND w.is_active = true AND w.stock_mode = 'exact' AND s.inventory_sqm >= ${quote.roundedQuantity} LIMIT 1`)
      if (available.rows.length) throw new APIError('EXACT_STOCK_AVAILABLE', 409, null, true)
      const imageId = product.cover ? idOf(product.cover) : product.gallery?.[0]?.image ? idOf(product.gallery[0].image) : null
      const image = imageId ? await req.payload.findByID({ collection: 'media', id: imageId, depth: 0, req }) : null
      const now = new Date()
      data.requestNumber = `SPR-${randomUUID()}`
      data.status = 'new'
      data.notes = notes
      data.idempotencyKey = supplyKeyHash(userId, key)
      data.requestFingerprint = supplyFingerprint(productId, warehouseId, Number(data.requestedQuantity), notes)
      Object.assign(data, quote, { salesFactor: factor, productType: product.productType ?? 'tile', unit: product.productType === 'other' ? product.unit ?? 'piece' : 'm2', cartonsPerPallet: product.productType === 'other' ? null : product.cartonsPerPallet ?? null, productSku: product.sku, productName: product.name, productImage: image?.url ?? null, warehouseName: warehouse.name, warehouseCode: warehouse.code, responseDueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(), reviewStartedAt: null, resolvedAt: null, cancelledAt: null, createdAt: now.toISOString() })
      return data
    }],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      if (operation !== 'update' || doc.status === previousDoc.status || !['supplied', 'unavailable'].includes(doc.status)) return
      try {
        const webUrl = process.env.WEB_URL?.replace(/\/+$/, '')
        if (!webUrl) { console.error('[SMS] Web URL is not configured'); return }
        const user = await req.payload.findByID({ collection: 'users', id: idOf(doc.user), depth: 0, req })
        if (user.phone) await sendSmsNotification({ receptor: user.phone, message: `نتیجه درخواست ${doc.requestNumber} ثبت شد. مشاهده: ${webUrl}/orders?view=supply&requestId=${doc.id}` })
      } catch { console.error('[SMS] Supply notification failed') }
    }],
  },
  fields: [
    { name: 'requestNumber', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { readOnly: true } },
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true, admin: { readOnly: true } },
    { name: 'warehouse', type: 'relationship', relationTo: 'warehouses', required: true, index: true, admin: { readOnly: true } },
    { name: 'status', type: 'select', required: true, defaultValue: 'new', options: [{ label: 'ثبت‌شده', value: 'new' }, { label: 'در حال بررسی', value: 'reviewing' }, { label: 'تأمین شده', value: 'supplied' }, { label: 'غیرقابل تأمین', value: 'unavailable' }, { label: 'لغو توسط مشتری', value: 'cancelled_by_customer' }] },
    ...(['requestedQuantity', 'packageCount', 'roundedQuantity', 'salesFactor', 'estimatedUnitPrice', 'estimatedTotal'] as const).map(name => ({ name, type: 'number' as const, required: true, admin: { readOnly: true } })),
    { name: 'cartonsPerPallet', type: 'number', admin: { readOnly: true } },
    ...(['productType', 'unit', 'productSku', 'productName', 'warehouseName', 'warehouseCode'] as const).map(name => ({ name, type: 'text' as const, required: true, admin: { readOnly: true } })),
    { name: 'productImage', type: 'text', admin: { readOnly: true } },
    { name: 'notes', type: 'textarea', defaultValue: '', maxLength: 2000, admin: { readOnly: true } },
    { name: 'responseDueAt', type: 'date', required: true, admin: { readOnly: true } },
    ...(['reviewStartedAt', 'resolvedAt', 'cancelledAt'] as const).map(name => ({ name, type: 'date' as const, admin: { readOnly: true } })),
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
    { name: 'requestFingerprint', type: 'text', required: true, admin: { hidden: true } },
  ],
}
