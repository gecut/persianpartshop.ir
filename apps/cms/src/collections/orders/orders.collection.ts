import type { CollectionConfig } from 'payload'
import { prepareOrderBeforeValidate } from './_prepare-order.before-validate'
import { applyReservationBeforeChange } from './_apply-reservation.before-change'
import { validateTransitionBeforeChange } from './_validate-transition.before-change'
import { isSalesManager, canCreateOrder, canUpdateOrder } from '../../access/roles'
import { lockOrderBeforeOperation } from './_lock-order.before-operation'

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: {
    singular: 'سفارش مشتری',
    plural: 'سفارشات مشتریان',
  },
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'user', 'status', 'finalTotal', 'createdAt'],
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
  },
  fields: [
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
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      label: 'وضعیت سفارش',
      admin: {
        position: 'sidebar',
        description: 'مرحله جاری پردازش در انبار و حسابداری.',
      },
      options: [
        { label: 'سفارش ثبت شده (در حال بررسی)', value: 'pending' },
        { label: 'حواله ثبت شده (تکمیل شده)', value: 'approve' },
        { label: 'تکمیل شده', value: 'completed' },
        { label: 'لغو توسط کاربر', value: 'cancelled_by_customer' },
        { label: 'لغو توسط ادمین', value: 'cancelled_by_admin' },
        { label: 'لغو شده', value: 'cancel' },
      ],
    },
    {
      name: 'cancelledBy',
      type: 'select',
      label: 'مرجع لغو',
      admin: {
        position: 'sidebar',
        description: 'سمت فرد لغو‌کننده سفارش.',
      },
      options: [
        { label: 'کاربر', value: 'customer' },
        { label: 'ادمین', value: 'admin' },
      ],
      defaultValue: 'admin',
    },
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
              label: 'متراژ درخواستی',
              admin: { width: '20%' },
            },
            {
              name: 'cartonCount',
              type: 'number',
              required: true,
              label: 'تعداد کارتن',
              admin: { width: '20%' },
            },
            {
              name: 'deliverableArea',
              type: 'number',
              required: true,
              label: 'متراژ تحویلی کارتن',
              admin: { width: '20%' },
            },
            {
              name: 'unitPrice',
              type: 'number',
              required: true,
              label: 'قیمت هر متر (تومان)',
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
    {
      name: 'deliveryAddress',
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
        position: 'sidebar',
        description: 'هماهنگی‌ها و توضیحات داخلی کارشناسان فروش.',
      },
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
        position: 'sidebar',
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
  ],
}
