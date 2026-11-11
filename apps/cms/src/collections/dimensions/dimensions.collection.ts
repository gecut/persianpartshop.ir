import { syncProductDimensions } from './_sync-products.after-change'
import type { CollectionConfig } from 'payload'
import { isCatalogManager } from '../../access/roles'

export const Dimensions: CollectionConfig = {
  slug: 'dimensions',
  labels: {
    singular: 'بُعد / سایز',
    plural: 'ابعاد',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'width', 'height', 'isActive'],
    group: 'محصولات و کاتالوگ',
    description: 'ابعاد استاندارد کاشی و سرامیک.',
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: { afterChange: [syncProductDimensions] },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'عنوان سایز',
      admin: {
        description: 'عنوان نمایشی ابعاد (مثال: ۶۰×۱۲۰ یا ۸۰×۸۰).',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'width',
          validate: (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0) || 'اندازه باید عدد مثبت باشد.',
          type: 'number',
          required: true,
          label: 'عرض (cm)',
          admin: {
            width: '50%',
            description: 'اندازه عرض فیزیکی به سانتی‌متر.',
          },
        },
        {
          name: 'height',
          validate: (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0) || 'اندازه باید عدد مثبت باشد.',
          type: 'number',
          required: true,
          label: 'طول (cm)',
          admin: {
            width: '50%',
            description: 'اندازه طول فیزیکی به سانتی‌متر.',
          },
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت انتشار',
      admin: {
        position: 'sidebar',
        description: 'نمایش و فعال بودن این سایز در فیلترها.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'شناسه فنی',
      admin: {
        description: 'شناسه انگلیسی یکتا در آدرس (مثال: 60x120).',
      },
    },
  ],
}
