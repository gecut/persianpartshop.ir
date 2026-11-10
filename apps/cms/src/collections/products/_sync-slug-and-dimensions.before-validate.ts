import { sql } from '@payloadcms/db-postgres'
import type { CollectionBeforeValidateHook } from 'payload'
import { getOrderTransaction } from '../orders/_transaction'
import { businessError, fieldError, relationId } from '../../lib/validation'
import { calculateStockCartons, roundToTwoDecimals } from './_inventory-math'

function skuSlug(sku: unknown): string {
  const raw = String(sku ?? '').trim()
  return raw.normalize('NFKC').toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sku-' + raw
}

export const syncSlugAndDimensions: CollectionBeforeValidateHook = async ({ data, originalDoc, operation, req }) => {
  if (!data) return data
  if (operation === 'create' && data.sqmPerCarton === undefined) data.sqmPerCarton = 1.44
  const effective = { ...originalDoc, ...data }
  if (operation === 'create' && !data.slug && data.sku) data.slug = skuSlug(data.sku)
  if (operation === 'update' && !data.slug && originalDoc?.slug) data.slug = originalDoc.slug
  for (const key of ['basePricePerSqm', 'weight', 'piecesPerCarton', 'itemsPerPack']) {
    if (data[key] == null || data[key] === '') continue
    const number = Number(data[key])
    const integer = key !== 'weight'
    const minimum = key === 'piecesPerCarton' || key === 'itemsPerPack' ? 1 : 0
    if (!Number.isFinite(number) || number < minimum || (integer && !Number.isSafeInteger(number))) fieldError(key, 'مقدار باید عدد معتبر ' + (minimum ? 'صحیح و مثبت باشد.' : 'نامنفی باشد.'))
    data[key] = number
  }
  if ((effective.productType ?? 'tile') === 'tile') {
    const pieces = effective.piecesPerCarton === undefined ? 4 : effective.piecesPerCarton
    if (pieces == null || pieces === '' || !Number.isSafeInteger(Number(pieces)) || Number(pieces) < 1) fieldError('piecesPerCarton', 'تعداد در هر کارتن باید عدد صحیح مثبت باشد.')
    const factor = Number(effective.sqmPerCarton)
    if (effective.sqmPerCarton == null || effective.sqmPerCarton === '' || !Number.isFinite(factor) || factor < 0.01 || !Number.isSafeInteger(Math.round(factor * 100)) || Math.abs(factor * 100 - Math.round(factor * 100)) > 1e-7) {
      fieldError('sqmPerCarton', 'متراژ هر کارتن باید حداقل ۰٫۰۱ و دارای حداکثر دو رقم اعشار باشد.')
    }
    if (data.sqmPerCarton !== undefined) data.sqmPerCarton = roundToTwoDecimals(factor)
  }
  if (data.approxCoverage != null) data.approxCoverage = String(data.approxCoverage).trim()
  if (data.inventorySqm !== undefined && data.inventorySqm !== null) {
    const value = Number(data.inventorySqm)
    if (!Number.isFinite(value) || value < 0) fieldError('inventorySqm', 'موجودی متراژ باید عددی نامنفی باشد.')
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) fieldError('inventorySqm', 'دقت اعشار موجودی متراژ حداکثر ۲ رقم اعشار است.')
    data.inventorySqm = roundToTwoDecimals(value)
  }

  // Lock the dimension before products: dimension updates use the same lock order.
  const dimensionId = relationId(effective.dimension)
  if (dimensionId != null) {
    const id = Number(dimensionId)
    if (!Number.isSafeInteger(id) || id <= 0) fieldError('dimension', 'ابعاد انتخاب‌شده معتبر نیست.')
    const db = await getOrderTransaction(req)
    const result = await db.execute(sql`SELECT width, height FROM dimensions WHERE id = ${id} FOR SHARE`)
    if (!result.rows[0]) fieldError('dimension', 'ابعاد انتخاب‌شده یافت نشد.')
    data.width = Number(result.rows[0].width)
    data.height = Number(result.rows[0].height)
  } else if (data.dimension !== undefined || operation === 'create') {
    data.width = null
    data.height = null
  } else {
    delete data.width
    delete data.height
  }

  if (operation === 'update' && originalDoc) {
    const keys = ['sqmPerCarton', 'piecesPerCarton', 'productType', 'unit']
    const changed = keys.some(key => data[key] !== undefined && (data[key] ?? null) !== (originalDoc[key] ?? null))
    if (changed) {
      const db = await getOrderTransaction(req)
      const locked = await db.execute(sql`SELECT sqm_per_carton, pieces_per_carton, product_type, unit FROM products WHERE id = ${originalDoc.id} FOR UPDATE`)
      const current = locked.rows[0]
      const origFactor = Number(originalDoc.sqmPerCarton ?? 0)
      if (!current || Number(current.sqm_per_carton ?? 0) !== origFactor || Number(current.pieces_per_carton ?? 4) !== Number(originalDoc.piecesPerCarton ?? 4) || String(current.product_type ?? 'tile') !== String(originalDoc.productType ?? 'tile') || String(current.unit ?? '') !== String(originalDoc.unit ?? '')) throw businessError('اطلاعات بسته‌بندی تغییر کرده است؛ محصول را دوباره دریافت کنید.', 'STALE_PRODUCT')
      const salesUnitChanged = ['productType', 'unit'].some(key => data[key] !== undefined && data[key] !== originalDoc[key])
      if (salesUnitChanged) {
        const stock = await req.payload.find({ collection: 'warehouse-stock', where: { product: { equals: originalDoc.id } }, limit: 1, depth: 0, req })
        if (stock.totalDocs) throw businessError('این کالا رکورد انبار دارد؛ برای نوع یا واحد فروش متفاوت کالای جدید بسازید.', 'PRODUCT_HAS_STOCK')
      }
      const orders = await req.payload.find({ collection: 'orders', where: { and: [{ 'items.product': { equals: originalDoc.id } }, { status: { in: ['pending', 'approve'] } }] }, limit: 1, depth: 0, req })
      if (orders.totalDocs) throw businessError('تغییر ضریب بسته‌بندی یا تعداد در کارتن مجاز نیست؛ ابتدا سفارش باز ' + (orders.docs?.[0]?.trackingNumber ?? '') + ' را تکمیل یا لغو کنید.', 'PACKAGING_HAS_OPEN_ACTIVITY')
      const requests = await req.payload.find({ collection: 'supply-requests', where: { and: [{ product: { equals: originalDoc.id } }, { status: { in: ['new', 'reviewing'] } }] }, limit: 1, depth: 0, req })
      if (requests.totalDocs) throw businessError('تغییر بسته‌بندی مجاز نیست؛ ابتدا درخواست تأمین باز ' + (requests.docs?.[0]?.trackingNumber ?? '') + ' را تعیین تکلیف کنید.', 'PACKAGING_HAS_OPEN_ACTIVITY')
    }
  }
  delete data.stockCartons
  if (data.inventorySqm !== undefined || data.sqmPerCarton !== undefined) {
    const inventory = Number(data.inventorySqm ?? originalDoc?.inventorySqm ?? 0)
    data.stockCartons = effective.productType === 'other' ? inventory : calculateStockCartons(inventory, Number(data.sqmPerCarton ?? originalDoc?.sqmPerCarton ?? 1.44))
  }
  return data
}
