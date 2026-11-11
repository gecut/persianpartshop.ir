import { businessError } from '../../lib/validation'
import type { Access, CollectionConfig } from 'payload'
import { getAdminUser } from '../../access/roles'
import { sql } from '@payloadcms/db-postgres'
import { getOrderTransaction } from '../orders/_transaction'

export const manageWarehouses: Access = ({ req }) => {
  const user = getAdminUser(req.user)
  return Boolean(user && user.isActive !== false && (user.role === 'manager' || user.role === 'superadmin'))
}

export const readWarehouseStock: Access = (args) => {
  const user = getAdminUser(args.req.user)
  return Boolean(user && user.isActive !== false && (user.role === 'service' || user.role === 'manager' || user.role === 'superadmin'))
}

export const readWarehouses: Access = (args) => readWarehouseStock(args) || getAdminUser(args.req.user)?.role === 'support'

export const Warehouses: CollectionConfig = {
  slug: 'warehouses',
  labels: { singular: 'انبار', plural: 'انبارها' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'code', 'stockMode', 'isActive'], group: 'انبار و موجودی' },
  access: { read: readWarehouses, create: manageWarehouses, update: manageWarehouses, delete: () => false },
  fields: [
    { name: 'code', label: 'کد انبار', type: 'text', required: true, unique: true, admin: { description: 'پس از ایجاد انبار قابل تغییر نیست.' } },
    { name: 'name', label: 'نام انبار', type: 'text', required: true },
    { name: 'stockMode', label: 'نوع موجودی', type: 'select', required: true, defaultValue: 'exact', options: [{ label: 'موجودی قطعی', value: 'exact' }, { label: 'استعلامی', value: 'inquiry' }] },
    { name: 'isActive', label: 'انبار فعال', type: 'checkbox', required: true, defaultValue: true, admin: { position: 'sidebar' } },
  ],
  hooks: {
    beforeOperation: [async ({ args, operation, req }) => {
      if (operation !== 'update') return
      if (!('id' in args)) throw businessError('ویرایش گروهی انبار مجاز نیست.')
      const id = Number(args.id)
      if (!Number.isSafeInteger(id) || id <= 0) throw businessError('شناسه انبار معتبر نیست.')
      const db = await getOrderTransaction(req)
      await db.execute(sql`SELECT id FROM warehouses WHERE id = ${id} FOR UPDATE`)
    }],
    beforeDelete: [() => { throw businessError('انبار را به‌جای حذف، غیرفعال کنید.') }],
    beforeChange: [async ({ data, originalDoc, operation, req }) => {
      if (operation === 'update' && data.code !== undefined && data.code !== originalDoc.code) {
        throw businessError('کد انبار پس از ایجاد قابل تغییر نیست.')
      }
      if (operation === 'update' && data.stockMode !== undefined && data.stockMode !== originalDoc.stockMode) {
        const db = await getOrderTransaction(req)
        const id = Number(originalDoc.id)
        const refs = await db.execute(sql`SELECT 1 WHERE EXISTS (SELECT 1 FROM warehouse_stock WHERE warehouse_id = ${id}) OR EXISTS (SELECT 1 FROM orders WHERE warehouse_id = ${id}) OR EXISTS (SELECT 1 FROM supply_sources_legacy WHERE warehouse_id = ${id}) OR EXISTS (SELECT 1 FROM supply_requests WHERE warehouse_id = ${id})`)
        if (refs.rows.length) throw businessError('نوع انبار دارای سابقه قابل تغییر نیست؛ انبار جدید بسازید.')
      }
      return data
    }],
  },
}
