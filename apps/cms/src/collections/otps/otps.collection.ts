import type { CollectionConfig } from 'payload'
import { isSuperAdmin } from '../../access/roles'
import { isServiceAdmin } from './_otp-access'

export const Otps: CollectionConfig = {
  slug: 'otps',
  labels: {
    singular: 'کد ورود یکبار مصرف',
    plural: 'کدهای ورود یکبار مصرف (OTP)',
  },
  admin: {
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'user', 'code', 'attempts', 'expiresAt', 'cooldownUntil', 'updatedAt'],
    group: 'مدیریت و امنیت',
    description: 'کدهای یکبار مصرف ارسال‌شده جهت ورود مشتریان B2B به سامانه.',
  },
  access: {
    read: ({ req }) => isSuperAdmin({ req }) || isServiceAdmin({ req }),
    create: isServiceAdmin,
    update: isServiceAdmin,
    delete: ({ req }) => isSuperAdmin({ req }) || isServiceAdmin({ req }),
  },
  hooks: {
    afterRead: [
      ({ doc }: any) => {
        if (doc && doc.expiresAt && doc.code) {
          const nowMs = Date.now()
          const expiresAtMs = new Date(doc.expiresAt).getTime()
          if (nowMs > expiresAtMs) {
            doc.code = null
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      label: 'مشتری مرتبط',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
      label: 'شماره همراه',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'code',
      type: 'text',
      label: 'کد تایید فعال',
      admin: {
        readOnly: true,
        description: 'کد ۴رقمی پیامک‌شده (پس از مصرف یا انقضا خالی می‌شود).',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'expiresAt',
          type: 'date',
          required: true,
          label: 'زمان انقضای کد',
          admin: {
            width: '33.3%',
            readOnly: true,
          },
        },
        {
          name: 'cooldownUntil',
          type: 'date',
          required: true,
          label: 'مهلت ارسال مجدد (Cooldown)',
          admin: {
            width: '33.3%',
            readOnly: true,
          },
        },
        {
          name: 'attempts',
          type: 'number',
          required: true,
          defaultValue: 0,
          label: 'تعداد تلاش‌های ناموفق',
          admin: {
            width: '33.3%',
            readOnly: true,
          },
        },
      ],
    },
  ],
}
