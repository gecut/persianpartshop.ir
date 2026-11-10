import type { GlobalConfig, Payload, PayloadRequest } from 'payload'
import { isSuperAdmin } from '../access/roles'
import { normalizeReceptor } from '../modules/sms/kavenegar-client'

export const NotificationSettings: GlobalConfig = {
  slug: 'notification-settings',
  label: 'تنظیمات اعلان‌ها و پیامک',
  admin: {
    group: 'مدیریت و امنیت',
    description: 'مدیریت شماره‌های تماس مدیران جهت دریافت پیامک‌های سیستمی و نوتیفیکیشن‌ها',
  },
  access: {
    read: isSuperAdmin,
    update: isSuperAdmin,
  },
  fields: [
    {
      name: 'adminPhones',
      type: 'array',
      label: 'شماره‌های موبایل مدیران جهت دریافت هشدارها',
      fields: [
        {
          name: 'phone',
          type: 'text',
          required: true,
          label: 'شماره همراه مدیر (مثال: 09121234567)',
        },
        {
          name: 'name',
          type: 'text',
          label: 'نام مدیر / بخش',
        },
      ],
    },
    {
      name: 'enableOrderNotifications',
      type: 'checkbox',
      label: 'ارسال پیامک سفارش‌ها فعال باشد',
      defaultValue: true,
    },
    {
      name: 'enableSupplyNotifications',
      type: 'checkbox',
      label: 'ارسال پیامک درخواست‌های تأمین فعال باشد',
      defaultValue: true,
    },
  ],
}

export async function getNotificationSettings(
  payload: Payload,
  req?: PayloadRequest
): Promise<{
  adminPhones: string[]
  enableOrderNotifications: boolean
  enableSupplyNotifications: boolean
}> {
  try {
    const settings = (await payload.findGlobal({
      slug: 'notification-settings',
      depth: 0,
      req,
      overrideAccess: true,
    })) as any

    const adminPhones: string[] = Array.isArray(settings?.adminPhones)
      ? settings.adminPhones
          .map((item: any) => (typeof item?.phone === 'string' ? normalizeReceptor(item.phone) : ''))
          .filter(Boolean)
      : []

    return {
      adminPhones,
      enableOrderNotifications: settings?.enableOrderNotifications !== false,
      enableSupplyNotifications: settings?.enableSupplyNotifications !== false,
    }
  } catch {
    return {
      adminPhones: [],
      enableOrderNotifications: true,
      enableSupplyNotifications: true,
    }
  }
}
