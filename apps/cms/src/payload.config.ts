import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { importExportPlugin } from '@payloadcms/plugin-import-export'

import { Admins } from './collections/admins'
import { Users } from './collections/users'
import { Media } from './collections/media'
import { Categories } from './collections/categories'
import { Brands } from './collections/brands'
import { Tags } from './collections/tags'
import { Products } from './collections/products'
import { Orders } from './collections/orders'
import { Plans } from './collections/plans'
import { Dimensions } from './collections/dimensions'
import { CustomerTypes } from './collections/customer-types'
import { Otps } from './collections/otps'

import { fa } from '@payloadcms/translations/languages/fa'
import { en } from '@payloadcms/translations/languages/en'
import { isImportExportAuthorized } from './collections/products/_product-access'
import { getStockWriteMode, roundToTwoDecimals } from './collections/products/_inventory-math'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUri = process.env.DATABASE_URI || process.env.DATABASE_URL || ''
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build'

if (process.env.NODE_ENV === 'production' && !isBuildPhase && !process.env.PAYLOAD_SECRET) {
  throw new Error('FATAL: PAYLOAD_SECRET environment variable is missing in production runtime.')
}

export default buildConfig({
  i18n: {
    fallbackLanguage: 'fa',
    supportedLanguages: { fa },
    translations: {
      fa: {
        authentication: {
          apiKey: 'کلید دسترسی API',
          enableAPIKey: 'فعال‌سازی کلید دسترسی API',
          generateNewAPIKey: 'تولید کلید دسترسی جدید',
          generatingNewAPIKeyWillInvalidate: 'با ایجاد کلید جدید، کلید فعلی شما بی‌اعتبار خواهد شد. آیا مطمئن هستید؟',
          newAPIKeyGenerated: 'کلید جدید با موفقیت تولید شد.',
          checkYourEmailForPasswordReset: 'پیامی حاوی پیوند بازنشانی رمز عبور ارسال شد. لطفاً پوشه هرزنامه را نیز بررسی نمایید.',
          email: 'نشانی ایمیل',
          password: 'رمز عبور',
        },
        dashboard: {
          addButton: 'افزودن +',
          addWidget: 'افزودن ویجت',
          deleteWidget: 'حذف ویجت {{id}}',
          discardConfirmLabel: 'انصراف',
          discardMessage: 'تغییرات ذخیره‌نشده‌ای در چیدمان داشبورد دارید. آیا می‌خواهید آن‌ها را نادیده بگیرید؟',
          discardTitle: 'صرف‌نظر از تغییرات؟',
          editDashboard: 'ویرایش داشبورد',
          editingDashboard: 'در حال ویرایش داشبورد',
          noItems: 'هیچ ویجتی در داشبورد وجود ندارد. می‌توانید آن‌ها را از منوی بالای صفحه اضافه کنید.',
          resetLayout: 'بازنشانی چیدمان',
          searchWidgets: 'جستجوی ویجت‌ها...',
        },
        error: {
          incorrectCollection: 'مجموعه داده نامعتبر است.',
        },
        fields: {
          chooseBetweenCustomTextOrDocument: 'یک نشانی اینترنتی سفارشی وارد کنید یا به یک صفحه دیگر پیوند دهید.',
          customURL: 'نشانی اینترنتی سفارشی',
          enterURL: 'یک نشانی اینترنتی وارد کنید',
        },
        general: {
          globals: 'تنظیمات سراسری',
          payloadSettings: 'تنظیمات سامانه مدیریت',
          collections: 'مجموعه‌ها',
          dashboard: 'داشبورد',
          createdAt: 'تاریخ ایجاد',
          updatedAt: 'تاریخ به‌روزرسانی',
          ascending: 'صعودی',
          descending: 'نزولی',
        },
        upload: {
          pasteURL: 'جای‌گذاری نشانی اینترنتی',
        },
        validation: {
          trueOrFalse: 'مقدار این فیلد فقط می‌تواند درست یا نادرست باشد.',
        },
        'plugin-import-export': {
          allLocales: 'تمام زبان‌ها',
          collectionRequired: 'برای نمایش پیش‌نمایش، انتخاب مجموعه داده الزامی است',
          documentsToExport: '{{count}} رکورد برای خروجی',
          documentsToImport: '{{count}} رکورد برای بارگذاری',
          exportDocumentLabel: 'دریافت خروجی {{label}}',
          exportOptions: 'تنظیمات خروجی فایل',
          'field-collectionSlug-label': 'مجموعه داده',
          'field-depth-label': 'عمق ارتباطات',
          'field-drafts-label': 'شامل پیش‌نویس‌ها',
          'field-fields-label': 'فیلدهای خروجی',
          'field-format-label': 'فرمت خروجی',
          'field-importMode-create-label': 'ایجاد رکوردهای جدید',
          'field-importMode-label': 'حالت بارگذاری',
          'field-importMode-update-label': 'به‌روزرسانی رکوردهای موجود',
          'field-importMode-upsert-label': 'ایجاد یا به‌روزرسانی رکوردها',
          'field-limit-label': 'محدودیت تعداد رکورد',
          'field-locale-label': 'زبان / محلی‌سازی',
          'field-matchField-description': 'فیلد مرجع برای تطبیق با رکوردهای موجود در سیستم',
          'field-matchField-label': 'فیلد تطبیق (شناسه)',
          'field-name-label': 'نام فایل خروجی',
          'field-page-label': 'شماره صفحه',
          'field-selectionToUse-label': 'محدوده انتخاب داده‌ها',
          'field-sort-label': 'مرتب‌سازی بر اساس',
          'field-sort-order-label': 'جهت مرتب‌سازی',
          'field-status-label': 'وضعیت عملیات',
          'field-summary-label': 'گزارش بارگذاری داده‌ها',
          importDocumentLabel: 'بارگذاری فایل در {{label}}',
          importResults: 'نتایج پردازش فایل',
          limitCapped: 'تعداد به سقف مجاز {{limit}} رکورد محدود است',
          limitExceededExport: 'خروجی به {{limit}} رکورد محدود شده است',
          limitExceededImport: 'فایل ورودی دارای {{count}} رکورد است اما سقف مجاز {{limit}} است',
          matchBy: 'تطبیق بر اساس',
          mode: 'حالت',
          noDataToPreview: 'داده‌ای برای پیش‌نمایش یافت نشد',
          previewPageInfo: '{{start}} تا {{end}} از مجموع {{total}}',
          'selectionToUse-allDocuments': 'تمام رکوردهای این بخش',
          'selectionToUse-currentFilters': 'رکوردهای منطبق بر فیلتر فعلی',
          'selectionToUse-currentSelection': 'رکوردهای انتخاب‌شده',
          startImport: 'شروع بارگذاری',
          totalDocumentsCount: 'مجموع رکوردهای قابل پردازش: {{count}}',
          uploadFileToSeePreview: 'برای مشاهده پیش‌نمایش، فایل اکسل یا CSV را بارگذاری نمایید',
        },
      },
    },
  },
  admin: {
    user: Admins.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' - پنل مدیریت پرشین‌پارت',
      description: 'سامانه یکپارچه مدیریت کاتالوگ، انبار و سفارشات پرشین‌پارت',
    },
    components: {
      graphics: {
        Logo: '/components/admin/Logo#Logo',
        Icon: '/components/admin/Icon#Icon',
      },
      beforeLogin: ['/components/admin/LoginHeader#LoginHeader'],
      afterLogin: ['/components/admin/LoginFooter#LoginFooter'],
    },
  },
  collections: [
    // کاتالوگ و انبارداری
    Products,
    Categories,
    Dimensions,
    Brands,
    Tags,
    // مشتریان
    CustomerTypes,
    Orders,
    Plans,
    Users,
    Otps,
    // رسانه و مدیریت
    Media,
    Admins,
  ],
  plugins: [
    importExportPlugin({
      collections: [
        {
          slug: 'products',
          export: {
            format: 'csv',
            disableJobsQueue: true,
            hooks: {
              before: ({ data }) => {
                // Export template: strictly canonical 3 columns
                return data.map((row: any) => ({
                  sku: row.sku,
                  basePricePerSqm: row.basePricePerSqm ?? 0,
                  inventorySqm: row.inventorySqm ?? 0,
                }))
              },
            },
          },
          import: {
            disableJobsQueue: true,
            batchSize: 100,
            limit: 100, // Safe ceiling: max 100 rows per batch
            hooks: {
              before: ({ data, req }) => {
                const mode = getStockWriteMode()
                if (mode !== 'import') {
                  throw new Error('اجرای ایمپورت فقط در حالت نگهداری (CMS_STOCK_WRITE_MODE=import) مجاز است.')
                }

                // Mark request context so product beforeValidate hook recognizes official import operation
                if (req) {
                  ;(req as any).context = {
                    ...((req as any).context || {}),
                    isImportOperation: true,
                  }
                }

                if (data.length > 100) {
                  throw new Error('حداکثر سقف مجاز برای هر فایل ایمپورت ۱۰۰ ردیف است.')
                }

                const seenSkus = new Set<string>()

                return (data as any[]).map((doc, idx) => {
                  const rowNum = idx + 1
                  const rawSku = doc.sku !== undefined && doc.sku !== null ? String(doc.sku).trim() : ''
                  if (!rawSku) {
                    throw new Error(`ردیف ${rowNum}: کد کالا (sku) الزامی است.`)
                  }
                  if (seenSkus.has(rawSku)) {
                    throw new Error(`ردیف ${rowNum}: کد کالای تکراری در فایل: ${rawSku}`)
                  }
                  seenSkus.add(rawSku)

                  if (doc.basePricePerSqm === undefined || doc.basePricePerSqm === null || doc.basePricePerSqm === '') {
                    throw new Error(`ردیف ${rowNum}: ستون basePricePerSqm الزامی است.`)
                  }
                  const price = Number(doc.basePricePerSqm)
                  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
                    throw new Error(`ردیف ${rowNum}: قیمت پایه باید یک عدد صحیح و نامنفی باشد (${doc.basePricePerSqm}).`)
                  }

                  if (doc.inventorySqm === undefined || doc.inventorySqm === null || doc.inventorySqm === '') {
                    throw new Error(`ردیف ${rowNum}: ستون inventorySqm الزامی است.`)
                  }
                  const inv = Number(doc.inventorySqm)
                  if (!Number.isFinite(inv) || inv < 0) {
                    throw new Error(`ردیف ${rowNum}: موجودی متراژ باید یک عدد نامنفی و متناهی باشد (${doc.inventorySqm}).`)
                  }
                  const roundedInv = roundToTwoDecimals(inv)
                  if (Math.abs(inv - roundedInv) > 0.0001) {
                    throw new Error(`ردیف ${rowNum}: دقت اعشار موجودی متراژ حداکثر ۲ رقم است (${doc.inventorySqm}).`)
                  }

                  // Strictly whitelist operational columns only (no modifying name, media, packaging, slug)
                  return {
                    sku: rawSku,
                    basePricePerSqm: price,
                    inventorySqm: roundedInv,
                  }
                })
              },
            },
          },
        },
      ],
      overrideImportCollection: ({ collection }) => ({
        ...collection,
        labels: {
          singular: 'بارگذاری کاتالوگ (ایمپورت)',
          plural: 'بارگذاری کاتالوگ (ایمپورت)',
        },
        access: {
          read: isImportExportAuthorized,
          create: isImportExportAuthorized,
          update: () => false,
          delete: isImportExportAuthorized,
        },
        admin: {
          ...collection.admin,
          group: 'کاتالوگ و انبارداری',
          description: 'عملیات بارگذاری و به‌روزرسانی قیمت و موجودی (فقط در حالت CMS_STOCK_WRITE_MODE=import).',
        },
        fields: collection.fields.map((f: any) => {
          if (f.name === 'importMode') {
            return {
              ...f,
              label: 'حالت بارگذاری',
              defaultValue: 'update',
              admin: {
                ...f.admin,
                readOnly: true,
                description: 'در این سیستم فقط به‌روزرسانی اقلام موجود (update) مجاز است.',
              },
            }
          }
          if (f.name === 'matchField') {
            return {
              ...f,
              label: 'فیلد تطبیق ردیف‌ها',
              defaultValue: 'sku',
              admin: {
                ...f.admin,
                readOnly: true,
                description: 'تطبیق ردیف‌های فایل منحصراً بر اساس فیلد کد کالا (sku) انجام می‌شود.',
              },
            }
          }
          if (f.name === 'file') {
            return {
              ...f,
              label: 'فایل ورودی اکسل یا CSV',
            }
          }
          return f
        }),
      }),
      overrideExportCollection: ({ collection }) => ({
        ...collection,
        labels: {
          singular: 'خروجی کاتالوگ (اکسپورت)',
          plural: 'خروجی کاتالوگ (اکسپورت)',
        },
        access: {
          read: isImportExportAuthorized,
          create: isImportExportAuthorized,
          update: () => false,
          delete: isImportExportAuthorized,
        },
        admin: {
          ...collection.admin,
          group: 'کاتالوگ و انبارداری',
          description: 'خروجی اکسل/CSV قیمت و موجودی کاتالوگ.',
        },
        fields: collection.fields.map((f: any) => {
          if (f.name === 'format') {
            return {
              ...f,
              label: 'فرمت فایل خروجی',
            }
          }
          if (f.name === 'limit') {
            return {
              ...f,
              label: 'سقف تعداد رکوردها',
            }
          }
          return f
        }),
      }),
    }),
  ],
  editor: lexicalEditor(),
  graphQL: {
    disable: true,
  },
  secret: process.env.PAYLOAD_SECRET || 'persianpart-dev-secret-key-32-chars-long!!',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: databaseUri.startsWith('postgres')
    ? postgresAdapter({
        pool: {
          connectionString: databaseUri,
        },
        push: false,
      })
    : sqliteAdapter({
        client: {
          url: databaseUri || 'file:./payload.db',
        },
      }),
  sharp,
})
