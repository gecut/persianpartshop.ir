import type { CollectionConfig } from 'payload'
import { isSuperAdmin, getAdminUser } from '../../access/roles'
import { retrySmsEndpoint } from './_retry-sms.endpoint'
import { SMS_TEMPLATES } from '../../modules/sms/constants'

export const SmsQueue: CollectionConfig = {
  slug: 'sms-queue',
  labels: {
    singular: 'پیامک در صف',
    plural: 'صف پیامک‌ها',
  },
  admin: {
    useAsTitle: 'receptor',
    defaultColumns: ['receptor', 'template', 'status', 'attempts', 'sentAt', 'createdAt'],
    group: 'مدیریت و امنیت',
    description: 'صف و تاریخچه ارسال پیامک‌های سیستمی.',
  },
  access: {
    read: ({ req }) => {
      const admin = getAdminUser(req.user)
      return Boolean(admin && (admin.role === 'superadmin' || admin.role === 'manager'))
    },
    create: () => false,
    update: ({ req }) => {
      const admin = getAdminUser(req.user)
      return Boolean(admin && (admin.role === 'superadmin' || admin.role === 'manager'))
    },
    delete: isSuperAdmin,
  },
  endpoints: [retrySmsEndpoint],
  fields: [
    {
      name: 'receptor',
      type: 'text',
      required: true,
      index: true,
      label: 'شماره گیرنده',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'template',
      type: 'select',
      required: true,
      label: 'نام الگو',
      admin: {
        readOnly: true,
      },
      options: [
        { label: 'کد تایید ورود (OTP)', value: SMS_TEMPLATES.OTP },
        { label: 'ثبت سفارش خریدار', value: SMS_TEMPLATES.ORDER_REGISTERED },
        { label: 'تأیید سفارش خریدار', value: SMS_TEMPLATES.ORDER_APPROVED },
        { label: 'لغو سفارش خریدار', value: SMS_TEMPLATES.ORDER_CANCELLED },
        { label: 'اطلاع‌رسانی سفارش جدید به مدیران', value: SMS_TEMPLATES.ADMIN_NEW_ORDER },
        { label: 'اطلاع‌رسانی لغو سفارش به مدیران', value: SMS_TEMPLATES.ADMIN_ORDER_CANCELLED },
        { label: 'نتیجه درخواست تأمین', value: SMS_TEMPLATES.SUPPLY_RESULT },
        { label: 'اطلاع‌رسانی درخواست تأمین به مدیران', value: SMS_TEMPLATES.ADMIN_NEW_SUPPLY_REQUEST },
        { label: 'تخصیص طرح به مشتری', value: SMS_TEMPLATES.PLAN_ASSIGNED },
      ],
    },
    {
      name: 'tokens',
      type: 'json',
      required: true,
      label: 'پارامترهای الگو',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      label: 'وضعیت ارسال',
      options: [
        { label: 'در انتظار ارسال', value: 'pending' },
        { label: 'برنامه‌ریزی تلاش مجدد', value: 'retry_scheduled' },
        { label: 'ارسال شده', value: 'sent' },
        { label: 'ناموفق', value: 'failed' },
      ],
    },
    {
      name: 'attempts',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: 'تعداد دفعات تلاش',
    },
    {
      name: 'lastError',
      type: 'text',
      label: 'متن آخرین خطا',
    },
    {
      name: 'nextRetryAt',
      type: 'date',
      index: true,
      label: 'زمان تلاش مجدد',
    },
    {
      name: 'sentAt',
      type: 'date',
      label: 'زمان تحویل به درگاه',
    },
  ],
}
