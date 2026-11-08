import { sql } from '@payloadcms/db-postgres'
import type { CollectionConfig } from 'payload'
import { getOrderTransaction } from '../orders/_transaction'
import { manageWarehouses, readWarehouses } from '../warehouses/warehouses.collection'

const relationId = (value: unknown): number => Number(typeof value === 'object' && value !== null && 'id' in value ? value.id : value)

export const SupplySources: CollectionConfig = {
  slug: 'supply-sources',
  labels: { singular: 'منبع تأمین', plural: 'منابع تأمین' },
  admin: { group: 'کاتالوگ و انبارداری', defaultColumns: ['product', 'warehouse', 'isActive', 'lastReportedAt'] },
  access: { read: readWarehouses, create: manageWarehouses, update: manageWarehouses, delete: () => false },
  indexes: [{ fields: ['warehouse', 'product'], unique: true }],
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true, label: 'محصول' },
    { name: 'warehouse', type: 'relationship', relationTo: 'warehouses', required: true, index: true, label: 'انبار', filterOptions: { stockMode: { equals: 'inquiry' } } },
    { name: 'isActive', type: 'checkbox', required: true, defaultValue: true, label: 'فعال' },
    { name: 'lastReportedAt', type: 'date', required: true, defaultValue: () => new Date().toISOString(), label: 'تاریخ آخرین گزارش حضور کالا' },
  ],
  hooks: { beforeChange: [async ({ data, operation, originalDoc, req }) => {
    const warehouseId = relationId(data.warehouse ?? originalDoc?.warehouse)
    const productId = relationId(data.product ?? originalDoc?.product)
    if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0 || !Number.isSafeInteger(productId) || productId <= 0) throw new Error('محصول یا انبار معتبر نیست.')
    if (operation === 'update' && (warehouseId !== relationId(originalDoc.warehouse) || productId !== relationId(originalDoc.product))) throw new Error('محصول و انبار منبع قابل تغییر نیست.')
    const db = await getOrderTransaction(req)
    const result = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${warehouseId} AND stock_mode = 'inquiry' FOR SHARE`)
    if (result.rows.length !== 1) throw new Error('منبع فقط در انبار استعلامی مجاز است.')
    return data
  }] },
}
