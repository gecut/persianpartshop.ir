import type { CollectionConfig } from 'payload'
import { isCatalogManager } from '../../access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'فایل رسانه‌ای',
    plural: 'رسانه‌ها و تصاویر',
  },
  admin: {
    group: 'رسانه و محتوا',
    description: 'مدیریت تصاویر کالاها، لوگوها و فایل‌های سیستم',
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'متن جایگزین (Alt)',
      admin: {
        description: 'توضیح کوتاه تصویر جهت سئو و دسترس‌پذیری.',
      },
    },
  ],
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
  },
}
