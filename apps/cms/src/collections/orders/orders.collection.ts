import type { CollectionConfig, Field } from 'payload'
import { prepareOrderBeforeValidate } from './_prepare-order.before-validate'
import { applyReservationBeforeChange } from './_apply-reservation.before-change'
import { validateTransitionBeforeChange } from './_validate-transition.before-change'
import { isSalesManager, canCreateOrder, canUpdateOrder } from '../../access/roles'
import { lockOrderBeforeOperation } from './_lock-order.before-operation'
import { notifyOrderAfterChange } from './_notify-order.after-change'

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: {
    singular: 'سفارش مشتری',
    plural: 'سفارشات مشتریان',
  },
  admin: {
    useAsTitle: 'trackingNumber',
    defaultColumns: ['trackingNumber', 'user', 'warehouse', 'status', 'finalTotal', 'createdAt'],
    group: 'فروش و مشتریان',
    description: 'فهرست و وضعیت سفارشات.',
  },
  access: {
    read: isSalesManager,
    create: canCreateOrder,
    update: canUpdateOrder,
    delete: () => false,
  },
  hooks: {
    beforeOperation: [lockOrderBeforeOperation],
    beforeValidate: [prepareOrderBeforeValidate],
    beforeChange: [validateTransitionBeforeChange, applyReservationBeforeChange],
    afterChange: [notifyOrderAfterChange],
  },
  fields: [
    { name: 'trackingNumber', type: 'number', required: true, unique: true, label: 'شمارهٔ پیگیری', admin: { readOnly: true } },
    { name: 'requestFingerprint', type: 'text', admin: { hidden: true } },
    { name: 'warehouseName', type: 'text', admin: { hidden: true } },
    { name: 'warehouseCode', type: 'text', admin: { hidden: true } },
    {
      name: 'idempotencyKey',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'status',
      access: { update: ({ doc }) => !['completed', 'cancel', 'cancelled_by_customer', 'cancelled_by_admin'].includes(doc?.status) },
      type: 'select',
      required: true,
      defaultValue: 'pending',
      label: 'وضعیت سفارش',
      admin: {
        position: 'sidebar',
        description: 'پس از بررسی، حواله را صادر و پس از تحویل، سفارش را تکمیل کنید.',
      },
      options: [
        { label: 'ثبت‌شده (در انتظار بررسی)', value: 'pending' },
        { label: 'حواله صادرشده (در انتظار تحویل)', value: 'approve' },
        { label: 'تکمیل‌شده (تحویل نهایی)', value: 'completed' },
        { label: 'لغوشده توسط مشتری', value: 'cancelled_by_customer' },
        { label: 'لغوشده توسط مدیریت', value: 'cancelled_by_admin' },
        { label: 'لغوشده (سابقهٔ قدیمی)', value: 'cancel' },
      ],
      filterOptions: ({ options, data }) => options.filter(option => typeof option === 'string' || option.value !== 'cancel' || data.status === 'cancel'),
    },
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      label: 'شماره سفارش',
      admin: {
        description: 'شناسه یکتا و رسمی فاکتور سفارش در سیستم.',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'مشتری',
      admin: {
        description: 'خریدار یا شرکت ثبت‌کننده سفارش.',
      },
    },
    { name: 'warehouse', type: 'relationship', relationTo: 'warehouses', required: true, index: true, label: 'انبار تأمین' },
    { type: 'tabs', tabs: [
        { label: 'اقلام سفارش', fields: [
          {
      name: 'items',
      type: 'array',
      required: true,
      label: 'اقلام سفارش',
      labels: {
        singular: 'قلم سفارش',
        plural: 'اقلام سفارش',
      },
      fields: [
        { name: 'productName', type: 'text', label: 'نام کالا هنگام ثبت', admin: { readOnly: true } },
        { name: 'productSku', type: 'text', label: 'کد کالا هنگام ثبت', admin: { readOnly: true } },
        { name: 'productType', type: 'text', admin: { hidden: true } },
        { name: 'unit', type: 'text', label: 'واحد فروش', admin: { readOnly: true } },
        { name: 'salesFactor', type: 'number', admin: { hidden: true } },
        { name: 'cartonsPerPallet', type: 'number', admin: { hidden: true } },
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
          label: 'محصول',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'requestedArea',
              type: 'number',
              required: true,
              label: 'مقدار درخواستی',
              admin: { width: '20%' },
            },
            {
              name: 'cartonCount',
              type: 'number',
              required: true,
              label: 'تعداد بسته / واحد',
              admin: { width: '20%' },
            },
            {
              name: 'deliverableArea',
              type: 'number',
              required: true,
              label: 'مقدار قابل تحویل',
              admin: { width: '20%' },
            },
            {
              name: 'unitPrice',
              type: 'number',
              required: true,
              label: 'قیمت واحد (تومان)',
              admin: { width: '20%' },
            },
            {
              name: 'totalPrice',
              type: 'number',
              required: true,
              label: 'قیمت کل قلم (تومان)',
              admin: { width: '20%' },
            },
          ],
        },
      ],
    },
        ] },
        { label: 'مبالغ', fields: [
          {
      type: 'row',
      fields: [
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          label: 'جمع اقلام (تومان)',
          admin: {
            width: '25%',
            description: 'مجموع خالص بهای اقلام سفارش.',
          },
        },
        {
          name: 'discountAmount',
          type: 'number',
          defaultValue: 0,
          label: 'تخفیف (تومان)',
          admin: {
            width: '25%',
            description: 'مجموع تخفیف‌های رده و طرح.',
          },
        },
        {
          name: 'taxAmount',
          type: 'number',
          defaultValue: 0,
          label: 'مالیات (تومان)',
          admin: {
            width: '25%',
            description: 'مالیات و عوارض قانونی ارزش افزوده.',
          },
        },
        {
          name: 'finalTotal',
          type: 'number',
          required: true,
          label: 'مبلغ کل (تومان)',
          admin: {
            width: '25%',
            description: 'مبلغ نهایی قابل پرداخت فاکتور.',
          },
        },
      ],
    },
        ] },
        { label: 'تحویل و یادداشت', fields: [
          {
      name: 'deliveryAddress',
      access: { update: ({ doc }) => !['completed', 'cancel', 'cancelled_by_customer', 'cancelled_by_admin'].includes(doc?.status) },
      type: 'textarea',
      label: 'نشانی تحویل',
      admin: {
        description: 'آدرس نهایی مقصد بارگیری و تخلیه سفارش.',
      },
    },
          {
      name: 'notes',
      type: 'textarea',
      label: 'یادداشت داخلی',
      admin: {
        description: 'هماهنگی‌ها و توضیحات داخلی کارشناسان فروش.',
      },
    },
        ] },
        { label: 'وضعیت و سابقه', fields: [
          {
      name: 'cancelledBy',
      type: 'select',
      label: 'مرجع لغو',
      admin: {
        readOnly: true,
        description: 'سمت فرد لغوکننده سفارش.',
        condition: (data) => ['cancelled_by_customer', 'cancelled_by_admin', 'cancel'].includes(data?.status),
      },
      options: [
        { label: 'کاربر', value: 'customer' },
        { label: 'ادمین', value: 'admin' },
      ],

    },
          {
      name: 'timeline',
      type: 'array',
      label: 'گاه‌شمار وضعیت',
      labels: {
        singular: 'رویداد وضعیت',
        plural: 'گاه‌شمار رویدادها',
      },
      admin: {
        readOnly: true,
        description: 'ثبت زمانی تغییرات وضعیت سفارش.',
      },
      fields: [
        {
          name: 'timestamp',
          type: 'date',
          label: 'زمان رویداد',
        },
        {
          name: 'status',
          type: 'text',
          label: 'عنوان وضعیت',
        },
      ],
    },
        ] },
    ] },

  ],
}

function protectOrderFields(fields: Field[]): void {
  for (const field of fields) {
    if (field.type !== 'ui' && 'name' in field && ['orderNumber', 'user', 'warehouse', 'items', 'subtotal', 'discountAmount', 'taxAmount', 'finalTotal', 'timeline'].includes(field.name)) {
      field.access = { ...field.access, update: () => false }
    }
    if ('fields' in field) protectOrderFields(field.fields)
    if ('tabs' in field) for (const tab of field.tabs) protectOrderFields(tab.fields)
  }
}
protectOrderFields(Orders.fields)
