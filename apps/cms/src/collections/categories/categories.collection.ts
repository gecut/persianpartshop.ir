import { validateCategoryParent } from './_validate-parent.before-change'
import type { CollectionConfig } from 'payload'
import { isCatalogManager } from '../../access/roles'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: 'دسته‌بندی',
    plural: 'دسته‌بندی‌ها',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'ordering', 'isActive'],
    group: 'کاتالوگ و انبارداری',
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: { beforeChange: [validateCategoryParent] },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'نام دسته‌بندی',
      admin: {
        description: 'عنوان دسته‌بندی در فروشگاه (مثال: کاشی پرسلان، اسلب و...).',
      },
    },
    {
      name: 'ordering',
      type: 'number',
      defaultValue: 0,
      label: 'ترتیب نمایش',
      admin: {
        position: 'sidebar',
        description: 'اولویت چینش در منوی سایت (عدد کوچکتر بالاتر).',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: 'دسته‌بندی والد',
      admin: {
        position: 'sidebar',
        description: 'سرشاخه اصلی در صورت زیرمجموعه بودن این گروه.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت انتشار',
      admin: {
        position: 'sidebar',
        description: 'نمایش این دسته‌بندی در سایت.',
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
