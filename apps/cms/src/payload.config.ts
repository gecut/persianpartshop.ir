import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

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
import { Warehouses } from './collections/warehouses/warehouses.collection'
import { WarehouseStock } from './collections/warehouse-stock/warehouse-stock.collection'
import { AuditLogs } from './collections/audit-logs'

import { fa } from '@payloadcms/translations/languages/fa'
import { en } from '@payloadcms/translations/languages/en'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URI || ''
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
    Warehouses,
    WarehouseStock,
    // رسانه و مدیریت
    Media,
    Admins,
    AuditLogs,
  ],
  editor: lexicalEditor(),
  graphQL: {
    disable: true,
  },
  secret: process.env.PAYLOAD_SECRET || 'persianpart-dev-secret-key-32-chars-long!!',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: databaseUrl.startsWith('postgres')
    ? postgresAdapter({
        pool: {
          connectionString: databaseUrl,
        },
        push: false,
        prodMigrations: migrations,
      })
    : sqliteAdapter({
        client: {
          url: databaseUrl || 'file:./payload.db',
        },
      }),
  sharp,
})
