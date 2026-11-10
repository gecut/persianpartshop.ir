import { businessError, fieldError, sameRelation } from '../../lib/validation'
import { getSalesFactor } from '../products/_inventory-math'
import type { CollectionConfig } from 'payload'
import { stockImportEndpoints } from './_import.endpoints'
import { manageWarehouses, readWarehouseStock } from '../warehouses/warehouses.collection'
import { sql } from '@payloadcms/db-postgres'
import { getOrderTransaction } from '../orders/_transaction'

export const WarehouseStock: CollectionConfig = {
  slug: 'warehouse-stock',
  labels: { singular: 'موجودی انبار', plural: 'موجودی انبارها' },
  admin: {
    defaultColumns: ['warehouse', 'product', 'inventorySqm', 'stockCartons', 'isActive'],
    group: 'کاتالوگ و انبارداری',
    components: { beforeListTable: ['/collections/warehouse-stock/components/stock-import#StockImport'] },
  },
  endpoints: stockImportEndpoints,
  access: { read: readWarehouseStock, create: manageWarehouses, update: manageWarehouses, delete: () => false },
  indexes: [{ fields: ['warehouse', 'product'], unique: true }],
  fields: [
    {
      name: 'stockCartons',
      label: 'بسته / واحد قابل فروش',
      type: 'number',
      virtual: true,
      admin: { readOnly: true, description: 'این مقدار از موجودی و بسته‌بندی محصول محاسبه می‌شود.' },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const id = typeof siblingData.product === 'object' ? siblingData.product?.id : siblingData.product
            if (!id) return 0
            if (siblingData.inventorySqm == null) return null
            const product = await req.payload.findByID({ collection: 'products', id, depth: 0, req })
            return product.productType === 'other'
              ? Number(siblingData.inventorySqm)
              : Math.floor(Math.round(Number(siblingData.inventorySqm) * 100) / Math.round(getSalesFactor(product) * 100))
          },
        ],
      },
    },
    { name: 'warehouse', label: 'انبار', type: 'relationship', relationTo: 'warehouses', required: true, index: true },
    { name: 'product', label: 'محصول', type: 'relationship', relationTo: 'products', required: true, index: true },
    {
      name: 'inventorySqm',
      access: { update: () => false },
      label: 'موجودی قابل فروش در واحد اصلی کالا',
      type: 'number',
      required: false,
      min: 0,
      admin: {
        description:
          'برای کاشی مترمربع و برای سایر کالاها تعداد واحد فروش است. در انبار استعلامی خالی (null) است. اصلاح موجودی از مسیر کنترل‌شده انبار انجام می‌شود.',
      },
    },
    { name: 'revision', access: { update: () => false }, type: 'number', required: true, min: 0, defaultValue: 0, admin: { hidden: true } },
    { name: 'isActive', label: 'فعال', type: 'checkbox', required: true, defaultValue: true },
    { name: 'lastReportedAt', label: 'تاریخ آخرین گزارش حضور کالا', type: 'date' },
  ],
  hooks: {
    beforeOperation: [async ({ operation, args, req }) => {
      if (operation !== 'update') return
      if (!('id' in args)) throw businessError('ویرایش گروهی موجودی مجاز نیست.', 'BULK_UPDATE_FORBIDDEN')
      const id = Number(args.id)
      if (!Number.isSafeInteger(id) || id <= 0) fieldError('id', 'شناسهٔ موجودی نامعتبر است.')
      const db = await getOrderTransaction(req)
      await db.execute(sql`SELECT id FROM warehouse_stock WHERE id = ${id} FOR UPDATE`)
      const original = await req.payload.findByID({ collection: 'warehouse-stock', id, depth: 0, req, overrideAccess: true })
      for (const key of ['inventorySqm', 'revision']) {
        if (args.data[key] !== undefined && (args.data[key] ?? null) !== (original[key as 'inventorySqm' | 'revision'] ?? null)) fieldError(key, 'عدد موجودی فقط از مسیر کنترل‌شدهٔ انبار قابل تغییر است.')
      }
    }],
    beforeDelete: [() => { throw businessError('حذف موجودی انبار مجاز نیست؛ مقدار آن را اصلاح کنید.') }],
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const warehouseId = Number(
          typeof (data.warehouse ?? originalDoc?.warehouse) === 'object'
            ? (data.warehouse ?? originalDoc?.warehouse)?.id
            : (data.warehouse ?? originalDoc?.warehouse)
        )
        if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) fieldError('warehouse', 'انبار معتبر نیست.')
        const db = await getOrderTransaction(req)
        const warehouseResult = await db.execute(sql`SELECT id, stock_mode FROM warehouses WHERE id = ${warehouseId} FOR SHARE`)
        if (warehouseResult.rows.length !== 1) throw businessError('انبار یافت نشد.')
        const stockMode = warehouseResult.rows[0]!.stock_mode

        if (operation === 'update') {
          for (const key of ['warehouse', 'product']) {
            if (data[key] !== undefined && !sameRelation(data[key], originalDoc[key])) fieldError(key, 'محصول و انبار این رکورد قابل تغییر نیستند؛ رکورد جدید بسازید.')
          }
          for (const key of ['inventorySqm', 'revision']) {
            if (data[key] !== undefined && (data[key] ?? null) !== (originalDoc[key] ?? null)) fieldError(key, 'عدد موجودی فقط از مسیر کنترل‌شدهٔ انبار قابل تغییر است.')
            data[key] = originalDoc[key]
          }
          return data
        }

        const productId = Number(typeof data.product === 'object' ? data.product?.id : data.product)
        if (!Number.isSafeInteger(productId) || productId <= 0) fieldError('product', 'محصول معتبر نیست.')
        await db.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR SHARE`)

        // operation === 'create'
        if (stockMode === 'inquiry') {
          if (data.inventorySqm != null) fieldError('inventorySqm', 'انبار استعلامی نمی‌تواند موجودی عددی داشته باشد.')
          data.inventorySqm = null
          data.revision = 0
          if (!data.lastReportedAt) data.lastReportedAt = new Date().toISOString()
          return data
        }

        if (stockMode === 'exact') {
          const amount = data.inventorySqm ?? 0
          if (
            typeof amount !== 'number' ||
            !Number.isFinite(amount) ||
            amount < 0 ||
            Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7 ||
            !Number.isSafeInteger(Math.round(amount * 100))
          ) {
            fieldError('inventorySqm', 'موجودی باید عددی نامنفی با حداکثر دو رقم اعشار باشد.')
          }
          data.revision = 0
          return data
        }

        throw businessError('نوع انبار نامعتبر است.')
      },
    ],
  },
}
