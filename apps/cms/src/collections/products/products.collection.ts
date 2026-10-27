import type { CollectionConfig } from 'payload'
import { syncSlugAndDimensions } from './_sync-slug-and-dimensions.before-validate'
import { isCatalogManager } from '../../access/roles'
import { canUpdateOperationalPrice, canUpdateOperationalInventory } from './_product-access'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'محصول',
    plural: 'محصولات',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sku', 'sqmPerCarton', 'stockCartons', 'isActive', 'updatedAt'],
    group: 'کاتالوگ و انبارداری',
    description: 'کاتالوگ و موجودی محصولات.',
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: {
    beforeValidate: [syncSlugAndDimensions],
  },
  fields: [
    // --- فیلدهای سایدبار (مدیریت وضعیت و متادیتا) ---
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'وضعیت انتشار',
      admin: {
        position: 'sidebar',
        description: 'در صورت فعال بودن، در کاتالوگ فروشگاه نمایش داده می‌شود.',
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
        description: 'شناسه یکتا در آدرس صفحه وبسایت (تولید خودکار از روی کد کالا).',
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'دسته‌بندی',
      admin: {
        position: 'sidebar',
        description: 'گروه کالایی تخصصی در کاتالوگ فروشگاه.',
      },
    },
    {
      name: 'brand',
      type: 'relationship',
      relationTo: 'brands',
      label: 'برند / کارخانه',
      admin: {
        position: 'sidebar',
        description: 'کارخانه یا برند سازنده کالا.',
      },
    },
    {
      name: 'grade',
      type: 'select',
      label: 'درجه کیفی',
      admin: {
        position: 'sidebar',
        description: 'درجه‌بندی استاندارد کیفیت کارخانه‌ای.',
      },
      options: [
        { label: 'درجه ۱', value: 'grade_1' },
        { label: 'درجه ۲', value: 'grade_2' },
        { label: 'درجه ۳', value: 'grade_3' },
        { label: 'درجه ۴', value: 'grade_4' },
      ],
    },
    {
      name: 'color',
      type: 'text',
      label: 'رنگ غالب',
      admin: {
        position: 'sidebar',
        description: 'طیف رنگی اصلی کالا (مثال: سفید، طوسی، کرم).',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      label: 'برچسب‌ها',
      admin: {
        position: 'sidebar',
        description: 'ویژگی‌های کاربردی و فنی کالا.',
      },
    },

    // --- فیلدهای محتوای اصلی (تب‌بندی شده) ---
    {
      type: 'tabs',
      tabs: [
        {
          label: 'اطلاعات و انبارداری',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  label: 'نام کالا',
                  admin: {
                    width: '60%',
                    description: 'عنوان تجاری و رسمی کالا در فروشگاه و فاکتور.',
                  },
                },
                {
                  name: 'sku',
                  type: 'text',
                  required: true,
                  unique: true,
                  label: 'کد کالا (SKU)',
                  admin: {
                    width: '40%',
                    description: 'شناسه یکتای انبارداری کالا جهت تطبیق موجودی.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'basePricePerSqm',
                  type: 'number',
                  defaultValue: 0,
                  label: 'قیمت پایه (تومان)',
                  admin: {
                    width: '33.3%',
                    description: 'قیمت هر متر مربع بدون احتساب تخفیف رده مشتری.',
                  },
                  access: {
                    update: canUpdateOperationalPrice,
                    create: canUpdateOperationalPrice,
                  },
                },
                {
                  name: 'sqmPerCarton',
                  type: 'number',
                  required: true,
                  defaultValue: 1.44,
                  label: 'متراژ کارتن (م²)',
                  admin: {
                    width: '33.3%',
                    description: 'ضریب متراژ فیزیکی در هر کارتن (مثال: ۱.۴۴).',
                  },
                },
                {
                  name: 'inventorySqm',
                  type: 'number',
                  defaultValue: 0,
                  label: 'موجودی متراژ (م²)',
                  admin: {
                    width: '33.3%',
                    description: 'موجودی قابل سفارش پس از کسر رزروها (ویرایش در حالت نگهداری).',
                  },
                  access: {
                    update: canUpdateOperationalInventory,
                    create: canUpdateOperationalInventory,
                  },
                },
              ],
            },
            {
              name: 'stockCartons',
              type: 'number',
              label: 'تعداد کارتن (محاسبه خودکار)',
              defaultValue: 0,
              admin: {
                readOnly: true,
                description: 'محاسبه سیستمی در سرور: حاصل تقسیم موجودی بر متراژ کارتن.',
              },
            },
            {
              name: 'productPreviewUi',
              type: 'ui',
              admin: {
                components: {
                  Field: '/collections/products/components/ProductPreview#ProductPreview',
                },
              },
            },
            {
              type: 'collapsible',
              label: 'ابعاد و بسته‌بندی فیزیکی',
              fields: [
                {
                  name: 'dimension',
                  type: 'relationship',
                  relationTo: 'dimensions',
                  required: true,
                  label: 'سایز / ابعاد',
                  admin: {
                    description: 'انتخاب سایز استاندارد کالا از لیست ابعاد.',
                  },
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'width',
                      type: 'number',
                      label: 'عرض (cm)',
                      admin: {
                        readOnly: true,
                        width: '50%',
                        description: 'عرض همگام‌شده پس از ذخیره.',
                      },
                    },
                    {
                      name: 'height',
                      type: 'number',
                      label: 'طول (cm)',
                      admin: {
                        readOnly: true,
                        width: '50%',
                        description: 'طول همگام‌شده پس از ذخیره.',
                      },
                    },
                  ],
                },
                {
                  name: 'piecesPerCarton',
                  type: 'number',
                  defaultValue: 4,
                  label: 'تعداد قطعه در کارتن',
                  admin: {
                    description: 'تعداد فیزیکی قالب/اسلب کاشی در کارتن (مستقل از متراژ).',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'تصاویر و محتوا',
          fields: [
            {
              name: 'cover',
              type: 'upload',
              relationTo: 'media',
              label: 'تصویر شاخص',
              admin: {
                description: 'تصویر اصلی و کاور محصول در کاتالوگ فروشگاه.',
              },
            },
            {
              name: 'gallery',
              type: 'array',
              label: 'گالری تصاویر',
              labels: {
                singular: 'تصویر',
                plural: 'تصاویر',
              },
              admin: {
                description: 'تصاویر تکمیلی و محیطی محصول.',
              },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                  label: 'تصویر گالری',
                },
              ],
            },
            {
              name: 'richDescription',
              type: 'richText',
              label: 'توضیحات تکمیلی',
              admin: {
                description: 'مشخصات فنی، ویژگی‌های لعاب و راهنمای نصب و نگهداری.',
              },
            },
          ],
        },
      ],
    },
  ],
}
