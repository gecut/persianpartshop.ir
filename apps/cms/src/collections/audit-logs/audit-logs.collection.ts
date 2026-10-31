import type { CollectionConfig } from 'payload'
import { isSuperAdmin } from '../../access/roles'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: {
    singular: 'لاگ فعالیت',
    plural: 'لاگ‌ها',
  },
  admin: {
    useAsTitle: 'target',
    defaultColumns: ['createdAt', 'adminName', 'action', 'entity', 'target', 'details'],
    group: 'مدیریت و امنیت',
  },
  access: {
    // Only superadmin can read and view logs!
    read: isSuperAdmin,
    // Created only by internal server hooks
    create: () => false,
    // Logs are immutable (cannot be modified)
    update: () => false,
    // Only superadmin can delete if needed
    delete: isSuperAdmin,
  },
  fields: [
    {
      name: 'action',
      type: 'select',
      required: true,
      label: 'نوع عملیات',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'ورود مدیر', value: 'admin_login' },
        { label: 'ایجاد کالا', value: 'product_create' },
        { label: 'ویرایش کالا', value: 'product_update' },
        { label: 'حذف کالا', value: 'product_delete' },
        { label: 'ایجاد مشتری', value: 'user_create' },
        { label: 'ویرایش مشتری', value: 'user_update' },
        { label: 'مسدودسازی مشتری', value: 'user_ban' },
        { label: 'رفع مسدودی مشتری', value: 'user_unban' },
        { label: 'حذف مشتری', value: 'user_delete' },
        { label: 'مدیریت مدیران', value: 'admin_manage' },
        { label: 'سایر', value: 'other' },
      ],
    },
    {
      name: 'entity',
      type: 'select',
      required: true,
      label: 'بخش',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'محصولات', value: 'products' },
        { label: 'مشتریان', value: 'users' },
        { label: 'مدیران', value: 'admins' },
        { label: 'احراز هویت', value: 'auth' },
        { label: 'سفارشات', value: 'orders' },
      ],
    },
    {
      name: 'adminName',
      type: 'text',
      label: 'نام مدیر',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'admin',
      type: 'relationship',
      relationTo: 'admins',
      label: 'حساب مدیر',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'target',
      type: 'text',
      required: true,
      label: 'موضوع / شناسه هدف',
    },
    {
      name: 'details',
      type: 'textarea',
      label: 'جزئیات تغییرات',
    },
    {
      name: 'ip',
      type: 'text',
      label: 'نشانی IP',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
