import type { CollectionConfig } from 'payload'
import { personalizePlanAfterRead } from './_personalize-plan.after-read'
import { isSalesManager, canManagePlans } from '../../access/roles'

export const Plans: CollectionConfig = {
  slug: 'plans',
  labels: {
    singular: 'طرح اختصاصی',
    plural: 'طرح‌ها و بسته‌ها',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'users', 'createdAt'],
    group: 'فروش و مشتریان',
    description: 'طرح‌ها و تخفیف‌های مشتریان.',
  },
  access: {
    read: isSalesManager,
    create: canManagePlans,
    update: canManagePlans,
    delete: canManagePlans,
  },
  hooks: {
    afterRead: [personalizePlanAfterRead],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'عنوان طرح',
      admin: {
        description: 'عنوان بسته یا پیشنهاد ویژه (مثال: تخفیف ویژه خرید نقدی).',
      },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: 'متن طرح و شرایط',
      admin: {
        description: 'متن پیام یا توضیحات بسته تخفیفی برای خریدار.',
      },
    },
    {
      name: 'users',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: true,
      label: 'مشتریان هدف',
      admin: {
        position: 'sidebar',
        description: 'خریدارانی که این طرح اختصاصی به آن‌ها تعلق می‌گیرد.',
      },
    },
  ],
}
