import type { CollectionConfig } from 'payload'
import { isAdminAuthenticated } from '../../access/roles'
import { isQrManager } from './_access'
import { generateToken, normalizeToken } from './_token'
import { qrLabelEndpoints } from './_label.endpoints'

export const QrCodes: CollectionConfig = {
  slug: 'qr-codes',
  labels: { singular: 'کد QR', plural: 'کدهای QR' },
  admin: {
    useAsTitle: 'token',
    group: 'محصولات و کاتالوگ',
    defaultColumns: ['token', 'product', 'store', 'isActive'],
    listSearchableFields: ['token', 'store', 'note'],
    components: {
      beforeListTable: ['/collections/qr-codes/components/qr-export#QrExport'],
    },
  },
  endpoints: qrLabelEndpoints,
  access: {
    read: isAdminAuthenticated,
    create: isQrManager,
    update: isQrManager,
    delete: () => false,
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      maxLength: 8,
      label: 'توکن',
      access: { update: () => false },
      admin: { readOnly: true, description: 'توکن به‌صورت خودکار ساخته می‌شود و تغییر نمی‌کند.' },
      hooks: {
        beforeValidate: [
          ({ value, operation }) => {
            if (operation === 'create' && (typeof value !== 'string' || !value.trim())) return generateToken()
            return typeof value === 'string' ? (normalizeToken(value) ?? value.trim().toUpperCase()) : value
          },
        ],
      },
      validate: (value: string | null | undefined) =>
        normalizeToken(value) ? true : 'توکن باید ۸ نویسهٔ لاتین بزرگ یا رقم (بدون 0، 1، I، L، O) باشد.',
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      index: true,
      maxDepth: 0,
      label: 'محصول متصل',
      admin: { description: 'خالی بگذارید تا کد فعلاً بدون محصول بماند. هر زمان می‌توانید محصول را عوض کنید.' },
    },
    { name: 'store', type: 'text', maxLength: 120, label: 'فروشگاه / محل نصب' },
    { name: 'note', type: 'textarea', label: 'یادداشت' },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'فعال',
      admin: { description: 'با غیرفعال‌کردن، اسکن این کد برای مشتری «کد فعال نیست» نشان می‌دهد.' },
    },
    {
      name: 'labelPreview',
      type: 'ui',
      admin: { components: { Field: '/collections/qr-codes/components/qr-preview#QrPreview' } },
    },
  ],
}
