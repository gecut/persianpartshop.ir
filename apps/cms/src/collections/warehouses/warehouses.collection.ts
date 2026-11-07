import type { Access, CollectionConfig } from 'payload'
import { getAdminUser } from '../../access/roles'

export const manageWarehouses: Access = ({ req }) => {
  const user = getAdminUser(req.user)
  return Boolean(user && user.isActive !== false && (user.role === 'manager' || user.role === 'superadmin'))
}

export const readWarehouses: Access = (args) => {
  const user = getAdminUser(args.req.user)
  return Boolean(user && user.isActive !== false && (user.role === 'service' || user.role === 'manager' || user.role === 'superadmin'))
}

export const Warehouses: CollectionConfig = {
  slug: 'warehouses',
  labels: { singular: 'انبار', plural: 'انبارها' },
  admin: { useAsTitle: 'name', group: 'کاتالوگ و انبارداری' },
  access: { read: readWarehouses, create: manageWarehouses, update: manageWarehouses, delete: () => false },
  fields: [
    { name: 'code', label: 'کد انبار', type: 'text', required: true, unique: true, admin: { description: 'پس از ایجاد انبار قابل تغییر نیست.' } },
    { name: 'name', label: 'نام انبار', type: 'text', required: true },
    { name: 'isActive', label: 'انبار فعال', type: 'checkbox', required: true, defaultValue: true, admin: { position: 'sidebar' } },
  ],
  hooks: {
    beforeDelete: [() => { throw new Error('انبار را به‌جای حذف، غیرفعال کنید.') }],
    beforeChange: [({ data, originalDoc, operation }) => {
      if (operation === 'update' && data.code !== undefined && data.code !== originalDoc.code) {
        throw new Error('کد انبار پس از ایجاد قابل تغییر نیست.')
      }
      return data
    }],
  },
}
