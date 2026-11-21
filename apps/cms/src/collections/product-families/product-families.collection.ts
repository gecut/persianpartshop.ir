import type { CollectionConfig } from 'payload'
import { isAdminAuthenticated, isCatalogManager } from '../../access/roles'

export const ProductFamilies: CollectionConfig = {
  slug: 'product-families',
  labels: {
    singular: 'طرح',
    plural: 'طرح‌ها',
  },
  admin: {
    useAsTitle: 'name',
    group: 'محصولات و کاتالوگ',
    defaultColumns: ['name', 'updatedAt'],
  },
  access: {
    read: isAdminAuthenticated,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 160,
      label: 'نام طرح',
      admin: {
        description: 'مثلاً «آلاوس — پرسپولیس یزد».',
      },
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim() : value),
        ],
      },
      validate: (value: string | null | undefined) => {
        if (!value || typeof value !== 'string' || !value.trim()) {
          return 'نام طرح الزامی است.'
        }
        return true
      },
    },
    {
      name: 'products',
      type: 'join',
      collection: 'products',
      on: 'family',
      label: 'کالاهای این طرح',
      admin: {
        defaultColumns: ['name', 'sku', 'grade', 'dimension', 'color', 'isActive'],
      },
    },
  ],
}
