import type { CollectionConfig } from 'payload'
import { isCatalogManager } from '../../access/roles'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: {
    singular: 'برچسب',
    plural: 'برچسب‌ها',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive'],
    group: 'محصولات و کاتالوگ',
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
      label: 'عنوان برچسب',
      admin: {
        description: 'عنوان ویژگی یا کاربرد کالا (مانند پرسلان، پولیش، ضداسید).',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت انتشار',
      admin: {
        position: 'sidebar',
        description: 'فعال بودن این برچسب در فیلترهای کاتالوگ.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'شناسه فنی',
      admin: {
        description: 'شناسه انگلیسی یکتا در آدرس اینترنتی.',
      },
    },
  ],
}
