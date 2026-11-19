import type { GlobalConfig } from 'payload'
import { CATALOG_PRICE_CHANGE_THRESHOLD, CatalogSettingsSchema, defaultCatalogSettings } from '@persianpart/contract/public-catalog'
import { getAdminUser } from '../access/roles'
import {
  manageWarehouses,
  readWarehouseStock,
} from '../collections/warehouses/warehouses.collection'
import { fieldError } from '../lib/validation'

export function validateCatalogSave(
  data: Record<string, unknown>,
  previous: unknown,
  editorId: number,
) {
  const parsed = CatalogSettingsSchema.safeParse(data.policy)
  if (!parsed.success)
    fieldError(
      'policy',
      'تنظیمات کاتالوگ معتبر نیستند؛ درصد، فیلدهای عددی، بازهٔ قیمت و نشانی‌های تماس را بررسی کنید.',
    )
  const original = CatalogSettingsSchema.safeParse(previous)
  const percentage = original.success ? original.data.pricing.percentage : 0
  if (
    Math.abs(parsed.data.pricing.percentage - percentage) >
      CATALOG_PRICE_CHANGE_THRESHOLD &&
    data.confirmPriceChange !== true
  ) {
    fieldError(
      'confirmPriceChange',
      'تغییر بیش از ۱۰ واحد درصد را صریحاً تأیید کنید.',
    )
  }
  return {
    policy: parsed.data,
    lastEditedBy: editorId,
    confirmPriceChange: false,
  }
}

export const CatalogSettingsGlobal: GlobalConfig = {
  slug: 'catalog-settings',
  label: 'تنظیمات کاتالوگ عمومی',
  admin: {
    group: 'محصولات و کاتالوگ',
    description:
      'سیاست انتشار عمومی؛ ذخیرهٔ تنظیمات بلافاصله در CMS اعمال می‌شود و صفحات با ISR به‌روز می‌شوند.',
  },
  access: {
    read: readWarehouseStock,
    readVersions: manageWarehouses,
    update: manageWarehouses,
  },
  versions: { drafts: false, max: 100 },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, req }) => {
        const editor = getAdminUser(req.user)
        if (!editor || !['manager', 'superadmin'].includes(editor.role))
          fieldError('policy', 'ویرایش تنظیمات کاتالوگ مجاز نیست.')
        const previous =
          originalDoc &&
          typeof originalDoc === 'object' &&
          'policy' in originalDoc
            ? originalDoc.policy
            : undefined
        return validateCatalogSave(
          data as Record<string, unknown>,
          previous,
          Number(editor.id),
        )
      },
    ],
  },
  fields: [
    {
      name: 'policy',
      type: 'json',
      required: true,
      label: 'سیاست کاتالوگ',
      defaultValue: defaultCatalogSettings,
      admin: {
        components: {
          Field:
            '/globals/components/catalog-settings-field#CatalogSettingsField',
        },
      },
    },
    {
      name: 'confirmPriceChange',
      type: 'checkbox',
      virtual: true,
      defaultValue: false,
      label: 'تغییر بیش از ۱۰ واحد درصد قیمت را تأیید می‌کنم',
      admin: {
        readOnly: false,
        description: 'این تأیید برای یک ذخیره است و پس از ذخیره پاک می‌شود.',
      },
    },
    {
      name: 'lastEditedBy',
      type: 'number',
      label: 'شناسهٔ آخرین ویرایشگر',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
