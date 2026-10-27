import type { CollectionConfig } from 'payload'
import { isCatalogManager } from '../../access/roles'

export const Brands: CollectionConfig = {
  slug: 'brands',
  labels: {
    singular: 'برند',
    plural: 'برندها',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive'],
    group: 'کاتالوگ و انبارداری',
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
      label: 'نام برند',
      admin: {
        description: 'عنوان تجاری برند یا کارخانه سازنده.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'نشان و لوگو',
      admin: {
        description: 'نشان تجاری برند جهت نمایش در صفحات و فیلترها.',
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
        description: 'شناسه انگلیسی برند در آدرس سایت.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت انتشار',
      admin: {
        position: 'sidebar',
        description: 'فعال بودن برند در سایت و فیلترها.',
      },
    },
  ],
}
