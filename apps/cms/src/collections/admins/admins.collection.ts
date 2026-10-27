import type { CollectionConfig } from 'payload'
import { isActiveBeforeLogin } from './_is-active.before-login'
import {
  isSuperAdmin,
  isAdminAuthenticated,
  isSelfAdminOrSuperAdmin,
  isSuperAdminField,
} from '../../access/roles'

export const Admins: CollectionConfig = {
  slug: 'admins',
  labels: {
    singular: 'مدیر',
    plural: 'مدیران',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'isActive', 'updatedAt'],
    group: 'مدیریت و امنیت',
  },
  auth: {
    useAPIKey: true,
  },
  hooks: {
    beforeLogin: [isActiveBeforeLogin],
  },
  access: {
    read: isSelfAdminOrSuperAdmin,
    create: isSuperAdmin,
    update: isSelfAdminOrSuperAdmin,
    delete: isSuperAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'نام کامل',
      admin: {
        description: 'نام و نام خانوادگی مدیر سیستم جهت ثبت در لاگ‌ها.',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      label: 'سطح دسترسی',
      access: {
        update: isSuperAdminField,
      },
      admin: {
        position: 'sidebar',
        description: 'نقش اداری و حیطه مجوزهای عملیاتی در سامانه.',
      },
      options: [
        { label: 'مدیر کل', value: 'superadmin' },
        { label: 'مدیر فروش', value: 'manager' },
        { label: 'ویرایشگر', value: 'editor' },
        { label: 'پشتیبانی', value: 'support' },
        { label: 'سرویس ماشینی', value: 'service' },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت حساب',
      access: {
        update: isSuperAdminField,
      },
      admin: {
        position: 'sidebar',
        description: 'امکان ورود این کاربر مدیر به سامانه.',
      },
    },
  ],
}
