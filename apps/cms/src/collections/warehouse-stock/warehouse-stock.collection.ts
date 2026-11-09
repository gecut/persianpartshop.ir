import { getSalesFactor } from '../products/_inventory-math'
import type { CollectionConfig } from 'payload'
import { stockImportEndpoints } from './_import.endpoints'
import { manageWarehouses, readWarehouses } from '../warehouses/warehouses.collection'
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
  access: { read: readWarehouses, create: manageWarehouses, update: manageWarehouses, delete: () => false },
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
      label: 'موجودی قابل فروش در واحد اصلی کالا',
      type: 'number',
      required: false,
      min: 0,
      admin: {
        description:
          'برای کاشی مترمربع و برای سایر کالاها تعداد واحد فروش است. در انبار استعلامی خالی (null) است. اصلاح موجودی از مسیر کنترل‌شده انبار انجام می‌شود.',
      },
    },
    { name: 'revision', type: 'number', required: true, min: 0, defaultValue: 0, admin: { hidden: true } },
    { name: 'isActive', label: 'فعال', type: 'checkbox', required: true, defaultValue: true },
    { name: 'lastReportedAt', label: 'تاریخ آخرین گزارش حضور کالا', type: 'date' },
  ],
  hooks: {
    beforeDelete: [() => { throw new Error('حذف موجودی انبار مجاز نیست؛ مقدار آن را اصلاح کنید.') }],
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const warehouseId = Number(
          typeof (data.warehouse ?? originalDoc?.warehouse) === 'object'
            ? (data.warehouse ?? originalDoc?.warehouse)?.id
            : (data.warehouse ?? originalDoc?.warehouse)
        )
        if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) throw new Error('انبار معتبر نیست.')
        const db = await getOrderTransaction(req)
        const warehouseResult = await db.execute(sql`SELECT id, stock_mode FROM warehouses WHERE id = ${warehouseId} FOR SHARE`)
        if (warehouseResult.rows.length !== 1) throw new Error('انبار یافت نشد.')
        const stockMode = warehouseResult.rows[0]!.stock_mode

        if (operation === 'update') {
          if (stockMode === 'exact') {
            throw new Error('موجودی فقط از مسیر کنترل‌شدهٔ انبار قابل تغییر است.')
          }
          data.inventorySqm = null
          return data
        }

        // operation === 'create'
        if (stockMode === 'inquiry') {
          if (data.inventorySqm != null) throw new Error('انبار استعلامی نمی‌تواند موجودی عددی داشته باشد.')
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
            throw new Error('موجودی باید عددی نامنفی با حداکثر دو رقم اعشار باشد.')
          }
          data.revision = 0
          return data
        }

        throw new Error('نوع انبار نامعتبر است.')
      },
    ],
  },
}
