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
    defaultColumns: ['name', 'width', 'height', 'slug', 'isActive', 'createdAt'],
    group: 'کاتالوگ و انبارداری',
    description: 'ابعاد استاندارد کاشی و سرامیک.',
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'اسلاگ URL',
      admin: {
        position: 'sidebar',
        description: 'شناسه انگلیسی یکتا در آدرس (مثال: 60x120).',
      },
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
  ],
}
