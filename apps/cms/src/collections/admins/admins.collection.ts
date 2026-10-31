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

        // Sync customer account in users collection so admin can act as a regular customer
        if (doc.phone) {
          try {
            const raw = String(doc.phone).trim()
            const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
            const normalized = raw.replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
            if (/^09\d{9}$/.test(normalized)) {
              const existingUsers = await req.payload.find({
                collection: 'users',
                where: {
                  or: [
                    { phone: { equals: normalized } },
                    { phone: { equals: raw } },
                  ],
                },
                limit: 1,
              })

              const adminRoleLabel = doc.role === 'superadmin' ? 'مدیر ارشد' : 'مدیر'
              if (existingUsers.docs.length === 0) {
                const defaultTypeRes = await req.payload.find({
                  collection: 'customer-types',
                  limit: 1,
                })
                const customerTypeId = defaultTypeRes.docs[0]?.id || 1

                await req.payload.create({
                  collection: 'users',
                  data: {
                    fullName: doc.name,
                    phone: normalized,
                    customerType: customerTypeId,
                    status: doc.isActive !== false ? 'active' : 'suspended',
                    notes: `حساب مشتری ایجاد شده برای ${adminRoleLabel} (${doc.name})`,
                  },
                  context: { skipLogging: true },
                })
              } else {
                const existing = existingUsers.docs[0]
                const updates: Record<string, any> = {}
                if (existing.fullName !== doc.name) updates.fullName = doc.name
                if (doc.isActive === false && existing.status === 'active') {
                  updates.status = 'suspended'
                }
                if (Object.keys(updates).length > 0) {
                  await req.payload.update({
                    collection: 'users',
                    id: existing.id,
                    data: updates,
                    context: { skipLogging: true },
                  })
                }
              }
            }
          } catch (syncErr) {
            console.error('Error syncing admin to customer user account:', syncErr)
          }
        }
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
      defaultValue: 'manager',
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
