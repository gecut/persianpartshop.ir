import type { CollectionConfig } from 'payload'
import { isSalesManager, canManageUsers, isSuperAdmin, canManageUsersField } from '../../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'مشتری',
    plural: 'مشتریان',
  },
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'phone', 'customerType', 'status', 'companyName', 'createdAt'],
    group: 'فروش و مشتریان',
    description: 'فهرست مشتریان و خریداران تجاری.',
  },
  access: {
    read: isSalesManager,
    create: canManageUsers,
    update: isSalesManager,
    delete: isSuperAdmin,
  },
  fields: [
    {
      name: 'phone',
      type: 'text',
      required: true,
      unique: true,
      label: 'شماره همراه',
      admin: {
        description: 'شناسه ورود مشتری با کد یکبار مصرف (OTP).',
      },
    },
    {
      name: 'fullName',
      type: 'text',
      required: true,
      label: 'نام خریدار',
      admin: {
        description: 'نام و نام خانوادگی خریدار یا نماینده خرید.',
      },
    },
    {
      name: 'companyName',
      type: 'text',
      label: 'نام تجاری',
      admin: {
        description: 'نام فروشگاه، شرکت یا پروژه ساختمانی.',
      },
    },
    {
      name: 'nationalCode',
      type: 'text',
      label: 'کد ملی',
      admin: {
        description: 'کد ملی جهت صدور فاکتور رسمی خریدار.',
      },
    },
    {
      name: 'economicCode',
      type: 'text',
      label: 'کد اقتصادی',
      admin: {
        description: 'شناسه اقتصادی جهت ثبت در گزارش فصلی.',
      },
    },
    {
      name: 'customerType',
      type: 'relationship',
      relationTo: 'customer-types',
      required: true,
      label: 'رده مشتری',
      access: {
        update: canManageUsersField,
      },
      admin: {
        position: 'sidebar',
        description: 'تعیین‌کننده درصد تخفیف و رده قیمت کاتالوگ.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      label: 'وضعیت حساب',
      access: {
        update: canManageUsersField,
      },
      admin: {
        position: 'sidebar',
        description: 'کنترل دسترسی مشتری جهت ثبت سفارش.',
      },
      options: [
        { label: 'فعال', value: 'active' },
        { label: 'در انتظار بررسی', value: 'pending' },
        { label: 'مسدود', value: 'suspended' },
      ],
    },
    {
      name: 'province',
      type: 'text',
      label: 'استان',
      admin: {
        description: 'استان محل فعالیت یا اقامت.',
      },
    },
    {
      name: 'city',
      type: 'text',
      label: 'شهر',
      admin: {
        description: 'شهر محل فعالیت.',
      },
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'نشانی اصلی',
      admin: {
        description: 'آدرس دفتر، انبار یا فروشگاه مرکزی.',
      },
    },
    {
      name: 'addresses',
      type: 'array',
      label: 'آدرس‌های تحویل',
      labels: {
        singular: 'نشانی',
        plural: 'نشانی‌ها',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'عنوان آدرس',
          admin: {
            description: 'مثال: انبار مرکزی، پروژه شماره ۲ و...',
          },
        },
        {
          name: 'province',
          type: 'text',
          required: true,
          label: 'استان',
        },
        {
          name: 'city',
          type: 'text',
          required: true,
          label: 'شهر',
        },
        {
          name: 'postalCode',
          type: 'text',
          label: 'کد پستی',
        },
        {
          name: 'addressDetail',
          type: 'textarea',
          required: true,
          label: 'نشانی کامل',
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'یادداشت داخلی',
      admin: {
        position: 'sidebar',
        description: 'یادداشت‌های اختصاصی مدیران فروش درباره سابقه مشتری.',
      },
    },
  ],
}
