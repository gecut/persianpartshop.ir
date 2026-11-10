import { businessError, fieldError } from '../../lib/validation'
import { nextTrackingNumber } from '../../lib/tracking-number'
import { getSalesFactor } from '../products/_inventory-math'
import type { CollectionBeforeValidateHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getOrderTransaction } from './_transaction'

export const prepareOrderBeforeValidate: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  if (!data) return data

  // 1. Immutable fields protection on update: cannot tamper orderNumber, user, subtotal, finalTotal, items, idempotencyKey
  if (operation === 'update') {
    return data
  }

  const db = await getOrderTransaction(req)
  const warehouseId = Number(typeof data.warehouse === 'object' ? data.warehouse?.id : data.warehouse)
  if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) fieldError('warehouse', 'انتخاب انبار الزامی است.')
  const lockedWarehouse = await db.execute(sql`SELECT id FROM warehouses WHERE id = ${warehouseId} AND is_active = true AND stock_mode = 'exact' FOR SHARE`)
  if (lockedWarehouse.rows.length !== 1) throw businessError('انبار انتخاب‌شده فعال نیست.')
  const warehouse = await req.payload.findByID({ collection: 'warehouses', id: warehouseId, depth: 0, req })
  data.warehouseName = warehouse.name
  data.warehouseCode = warehouse.code

  // 2. Check Idempotency Key replay on creation (scoped to user)
  if (data.idempotencyKey) {
    const userId =
      typeof data.user === 'object' && data.user !== null ? data.user.id : data.user

    const existingOrder = await req.payload.find({
      collection: 'orders',
      where: {
        and: [
          { idempotencyKey: { equals: String(data.idempotencyKey) } },
          ...(userId ? [{ user: { equals: userId } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      req,
    })

    if (existingOrder.docs.length > 0) {
      throw businessError(`سفارش قبلاً با این کلید تکرار ثبت شده است (شماره سفارش: ${existingOrder.docs[0].orderNumber})`, 'DUPLICATE_ORDER')
    }
  }

  data.trackingNumber = await nextTrackingNumber(req)
  data.orderNumber = String(data.trackingNumber)

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    fieldError('items', 'سفارش باید حداقل شامل یک قلم کالا باشد.')
  }

  if (data.items.length > 100) fieldError('items', 'سفارش حداکثر می‌تواند صد قلم داشته باشد.')

  // 4. Resolve and validate customer tier markup
  let customerMarkupPercent = 0
  let allowedCategoryIds: number[] = []
  const userId =
    typeof data.user === 'object' && data.user !== null ? data.user.id : data.user

  if (userId) {
    const userDoc = await req.payload.findByID({ collection: 'users', id: userId, depth: 1, req })
    if (userDoc.status !== 'active') throw businessError('حساب کاربری مشتری فعال نیست.', 'CUSTOMER_INACTIVE', 403)
    if (userDoc.disableOrdering || userDoc.hideExactStock) throw businessError('این مشتری فقط امکان مشاهدهٔ کاتالوگ را دارد و نمی‌تواند سفارش ثبت کند.', 'ORDERING_DISABLED', 403)
    allowedCategoryIds = (userDoc.allowedCategories ?? []).map(category => typeof category === 'object' ? category.id : category)
    if (typeof userDoc.customerType === 'object' && userDoc.customerType !== null) customerMarkupPercent = userDoc.customerType.markupPercent
  }

  // 5. Consolidate duplicate products & calculate authoritatively
  const consolidatedMap = new Map<number, number>()
  for (const [index, item] of data.items.entries()) {
    const productId = Number(
      typeof item.product === 'object' && item.product !== null
        ? item.product.id
        : item.product,
    )
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      fieldError(`items.${index}.product`, 'شناسه محصول نامعتبر است.')
    }

    const area = Number(item.requestedArea)
    if (!Number.isFinite(area) || area <= 0) {
      fieldError(`items.${index}.requestedArea`, 'مقدار درخواستی باید عددی مثبت باشد.')
    }

    const current = consolidatedMap.get(productId) || 0
    const nextArea = current + area
    if (!Number.isFinite(nextArea) || nextArea > 1_000_000) {
      fieldError(`items.${index}.requestedArea`, 'مقدار تجمیعی هر کالا حداکثر یک میلیون است.')
    }
    consolidatedMap.set(productId, nextArea)
  }

  const consolidatedItems: Array<{
    product: number
    requestedArea: number
    cartonCount: number
    deliverableArea: number
    unitPrice: number
    totalPrice: number
    productSku?: string
    productName?: string
    productType: string
    unit: string
    salesFactor: number
    cartonsPerPallet: number | null
  }> = []

  let calculatedSubtotal = 0

  for (const [productId, requestedArea] of [...consolidatedMap.entries()].sort(([a], [b]) => a - b)) {
    await db.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR SHARE`)
    const productDoc = await req.payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      req,
    })

    if (!productDoc) {
      throw businessError(`محصول با شناسه ${productId} یافت نشد.`)
    }

    if (productDoc.isActive === false) {
      throw businessError(`محصول ${productDoc.name || productId} غیرفعال است.`)
    }

    const categoryId = typeof productDoc.category === 'object' ? productDoc.category?.id : productDoc.category
    if (allowedCategoryIds.length && !allowedCategoryIds.includes(Number(categoryId))) throw businessError('دسترسی مشتری به دسته‌بندی کالا مجاز نیست.', 'FORBIDDEN', 403)
    const sqmPerCarton = getSalesFactor(productDoc)

    const basePrice = Number(productDoc.basePricePerSqm)
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw businessError(`قیمت پایه برای محصول ${productId} نامعتبر است.`)
    }

    // Whole cartons only
    const cartonCount = Math.ceil(requestedArea / sqmPerCarton)
    if (!Number.isSafeInteger(cartonCount) || cartonCount <= 0) {
      throw businessError(`تعداد کارتن محاسبه‌شده برای ${productId} نامعتبر است.`)
    }

    // Exact deliverable area: cartonCount * sqmPerCarton rounded to 2 decimals
    const deliverableArea = Math.round(cartonCount * sqmPerCarton * 100) / 100

    // Unit price with customer tier markup: integer Tomans
    const unitPrice = Math.round(basePrice * (1 + customerMarkupPercent / 100))
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      throw businessError(`قیمت واحد محاسبه‌شده برای ${productId} نامعتبر است.`)
    }

    const totalPrice = Math.round(deliverableArea * unitPrice)
    if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
      throw businessError(`قیمت کل محاسبه‌شده برای ${productId} نامعتبر است.`)
    }

    consolidatedItems.push({
      product: productId,
      productType: productDoc.productType ?? 'tile',
      unit: productDoc.productType === 'other' ? (productDoc.unit ?? 'piece') : 'm2',
      salesFactor: sqmPerCarton,
      cartonsPerPallet: productDoc.productType === 'other' ? null : productDoc.cartonsPerPallet ?? null,
      requestedArea,
      cartonCount,
      deliverableArea,
      unitPrice,
      totalPrice,
      productSku: productDoc.sku,
      productName: productDoc.name,
    })

    calculatedSubtotal += totalPrice
  }

  if (!Number.isSafeInteger(calculatedSubtotal) || calculatedSubtotal < 0) {
    throw businessError('جمع کل فاکتور خارج از محدوده مجاز است.')
  }

  data.items = consolidatedItems
  data.subtotal = calculatedSubtotal
  data.discountAmount = 0
  data.taxAmount = 0
  data.finalTotal = calculatedSubtotal

  return data
}
