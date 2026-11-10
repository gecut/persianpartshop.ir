import { syncAdminCustomer } from './_sync-customer.before-change'
import type { CollectionConfig } from 'payload'
import { isActiveBeforeLogin } from './_is-active.before-login'
import {
  isSuperAdmin,
  isSelfAdminOrSuperAdmin,
  isSuperAdminField,
} from '../../access/roles'
import { logAction } from '../audit-logs/log-action'

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
    beforeChange: [syncAdminCustomer],
    beforeLogin: [isActiveBeforeLogin],
    afterLogin: [
      async ({ user, req }) => {
        await logAction({
          payload: req.payload,
          req,
          action: 'admin_login',
          entity: 'auth',
          target: `ورود ${user.name || user.email}`,
          details: `ورود در ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`,
          adminId: user.id,
          adminName: user.name || user.email,
        })
        return user
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipLogging) return
        const isCreate = operation === 'create'
        let details = ''
        if (isCreate) {
          const roleLabel =
            doc.role === 'superadmin' ? 'مدیر ارشد' : doc.role === 'manager' ? 'مدیر' : doc.role
          details = `ایجاد حساب با سطح ${roleLabel}`
        } else {
          const changes: string[] = []
          if (previousDoc?.role !== doc.role) {
            changes.push(`نقش: ${previousDoc?.role} -> ${doc.role}`)
          }
          if (previousDoc?.isActive !== doc.isActive) {
            changes.push(`وضعیت: ${previousDoc?.isActive ? 'فعال' : 'غیرفعال'} -> ${doc.isActive ? 'فعال' : 'غیرفعال'}`)
          }
          if (previousDoc?.name !== doc.name) {
            changes.push(`نام: ${previousDoc?.name} -> ${doc.name}`)
          }
          if (previousDoc?.phone !== doc.phone) {
            changes.push(`موبایل: ${previousDoc?.phone || '-'} -> ${doc.phone || '-'}`)
          }
          if (previousDoc?.email !== doc.email) {
            changes.push(`ایمیل: ${previousDoc?.email} -> ${doc.email}`)
          }
          details = changes.length > 0 ? changes.join(' | ') : 'ویرایش مشخصات مدیر'
        }

        await logAction({
          payload: req.payload,
          req,
          action: 'admin_manage',
          entity: 'admins',
          target: `${doc.name || doc.email} (${doc.role === 'superadmin' ? 'مدیر ارشد' : 'مدیر'})`,
          details,
        })


      },
    ],
    afterDelete: [
      async ({ doc, id, req, context }) => {
        if (context?.skipLogging) return
        await logAction({
          payload: req.payload,
          req,
          action: 'admin_manage',
          entity: 'admins',
          target: `${doc?.name || doc?.email || 'مدیر'} (شناسه: ${id})`,
          details: `حذف حساب مدیر #${id}`,
        })
      },
    ],
  },
  access: {
    read: isSelfAdminOrSuperAdmin,
    create: isSuperAdmin,
    update: isSelfAdminOrSuperAdmin,
    delete: isSuperAdmin,
  },
  fields: [
    { name: 'customer', type: 'relationship', relationTo: 'users', unique: true, label: 'حساب مشتری مرتبط', access: { create: isSuperAdminField, update: isSuperAdminField }, admin: { description: 'فقط این حساب با مدیر همگام می‌شود؛ شمارهٔ مشابه به‌تنهایی ارتباط ایجاد نمی‌کند.' } },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'نام کامل',
      admin: {
        description: 'نام و نام خانوادگی جهت ثبت در لاگ‌ها',
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: false,
      label: 'شماره تلفن همراه',
      admin: {
        description: 'جهت ورود به عنوان کاربر عادی در فروشگاه و ثبت سفارش',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'superadmin',
      label: 'سطح دسترسی',
      access: {
        update: isSuperAdminField,
      },
      admin: {
        position: 'sidebar',
        description: 'نقش و حیطه دسترسی',
      },
      options: [
        { label: 'مدیر ارشد', value: 'superadmin' },
        { label: 'مدیر', value: 'manager' },
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
        description: 'امکان ورود به سامانه',
      },
    },
  ],
}
