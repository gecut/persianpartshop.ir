import type { CollectionConfig } from 'payload'
import { isCatalogManager, isSuperAdmin } from '../../access/roles'

export const CustomerTypes: CollectionConfig = {
  slug: 'customer-types',
  labels: {
    singular: 'رده مشتری',
    plural: 'رده‌های مشتریان',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'markupPercent', 'isActive', 'createdAt'],
    group: 'فروش و مشتریان',
    description: 'رده‌های مشتریان و ضریب قیمت (Markup).',
  },
  access: {
    read: isCatalogManager,
    create: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'عنوان رده',
      admin: {
        description: 'عنوان رسمی رده (مثال: همکار عمده، نماینده رسمی، مشتری عادی).',
      },
    },
    {
      name: 'markupPercent',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: 'ضریب قیمت (%)',
      admin: {
        description: 'درصد اثر بر قیمت پایه (منفی: تخفیف، مثبت: افزایش قیمت).',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'توضیحات و شرایط',
      admin: {
        description: 'شرایط احراز مشتری و توضیحات قرارداد این رده.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'اسلاگ URL',
      admin: {
        position: 'sidebar',
        description: 'شناسه انگلیسی یکتای رده.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت انتشار',
      admin: {
        position: 'sidebar',
        description: 'فعال بودن این رده مشتری در سیستم.',
      },
    },
  ],
}
