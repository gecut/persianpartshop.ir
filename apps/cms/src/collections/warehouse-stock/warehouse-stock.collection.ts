import { getSalesFactor } from '../products/_inventory-math'
import type { CollectionConfig } from 'payload'
import { stockImportEndpoints } from './_import.endpoints'
import { manageWarehouses, readWarehouses } from '../warehouses/warehouses.collection'

export const WarehouseStock: CollectionConfig = {
  slug: 'warehouse-stock',
  labels: { singular: 'موجودی انبار', plural: 'موجودی انبارها' },
  admin: { defaultColumns: ['warehouse', 'product', 'inventorySqm', 'stockCartons'], group: 'کاتالوگ و انبارداری', components: { beforeListTable: ['/collections/warehouse-stock/components/stock-import#StockImport'] } },
  endpoints: stockImportEndpoints,
  access: { read: readWarehouses, create: manageWarehouses, update: () => false, delete: () => false },
  indexes: [{ fields: ['warehouse', 'product'], unique: true }],
  fields: [
    { name: 'stockCartons', label: 'بسته / واحد قابل فروش', type: 'number', virtual: true, admin: { readOnly: true }, hooks: { afterRead: [async ({ siblingData, req }) => {
      const id = typeof siblingData.product === 'object' ? siblingData.product?.id : siblingData.product
      if (!id) return 0
      const product = await req.payload.findByID({ collection: 'products', id, depth: 0, req })
      return product.productType === 'other' ? Number(siblingData.inventorySqm) : Math.floor(Math.round(Number(siblingData.inventorySqm) * 100) / Math.round(getSalesFactor(product) * 100))
    }] } },
    { name: 'warehouse', label: 'انبار', type: 'relationship', relationTo: 'warehouses', required: true, index: true },
    { name: 'product', label: 'محصول', type: 'relationship', relationTo: 'products', required: true, index: true },
    { name: 'inventorySqm', label: 'موجودی قابل فروش در واحد اصلی کالا', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'revision', type: 'number', required: true, min: 0, defaultValue: 0, admin: { hidden: true } },
  ],
  hooks: {
    beforeDelete: [() => { throw new Error('حذف موجودی انبار مجاز نیست؛ مقدار آن را اصلاح کنید.') }],
    beforeChange: [({ data, operation }) => {
      if (operation === 'update') throw new Error('موجودی فقط از مسیر کنترل‌شدهٔ انبار قابل تغییر است.')
      const amount = data.inventorySqm ?? 0
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7 || !Number.isSafeInteger(Math.round(amount * 100))) {
        throw new Error('موجودی باید عددی نامنفی با حداکثر دو رقم اعشار باشد.')
      }
      data.revision = 0
      return data
    }],
  },
}
