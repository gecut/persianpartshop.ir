import type { CollectionBeforeValidateHook } from 'payload'
import { calculateStockCartons, getStockWriteMode, roundToTwoDecimals } from './_inventory-math'

function normalizeSkuToSlug(sku: unknown): string {
  const rawSku = String(sku ?? '').trim()
  const normalized = rawSku
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || `sku-${rawSku}`
}

export const syncSlugAndDimensions: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data) return data

  // 1. Slug handling:
  // In create operation: if slug is missing, generate from SKU.
  // In update operation: preserve existing slug from originalDoc if not explicitly provided or if unchanged.
  if (operation === 'create') {
    if (!data.slug && data.sku) {
      data.slug = normalizeSkuToSlug(data.sku)
    }
  } else if (operation === 'update') {
    if (!data.slug && originalDoc?.slug) {
      data.slug = originalDoc.slug
    }
  }

  // 2. Validate and enforce numeric boundaries
  if (data.basePricePerSqm !== undefined && data.basePricePerSqm !== null) {
    const price = Number(data.basePricePerSqm)
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      throw new Error('قیمت پایه هر متر مربع باید یک عدد صحیح و نامنفی باشد.')
    }
    data.basePricePerSqm = price
  }

  if (data.sqmPerCarton !== undefined && data.sqmPerCarton !== null) {
    const sqm = Number(data.sqmPerCarton)
    if (!Number.isFinite(sqm) || sqm <= 0) {
      throw new Error('ضریب متراژ هر کارتن باید یک عدد مثبت و بزرگتر از صفر باشد.')
    }
    data.sqmPerCarton = roundToTwoDecimals(sqm)
  }

  if (data.piecesPerCarton !== undefined && data.piecesPerCarton !== null) {
    const pieces = Number(data.piecesPerCarton)
    if (!Number.isFinite(pieces) || pieces < 1 || !Number.isInteger(pieces)) {
      throw new Error('تعداد در هر کارتن باید یک عدد صحیح و مثبت باشد.')
    }
    data.piecesPerCarton = pieces
  }

  // 3. Maintenance mode enforcement for inventorySqm edits:
  const stockMode = getStockWriteMode()
  const isImportContext = (req as any)?.context?.isImportOperation === true
  const incomingInventory = data.inventorySqm !== undefined && data.inventorySqm !== null
    ? Number(data.inventorySqm)
    : undefined

  if (incomingInventory !== undefined) {
    if (!Number.isFinite(incomingInventory) || incomingInventory < 0) {
      throw new Error('موجودی متراژ باید یک عدد نامنفی و متناهی باشد.')
    }
    // Check decimal precision (at most 2 decimal places)
    const rounded = roundToTwoDecimals(incomingInventory)
    if (Math.abs(incomingInventory - rounded) > 0.0001) {
      throw new Error('دقت اعشار موجودی متراژ حداکثر ۲ رقم اعشار است.')
    }
    data.inventorySqm = rounded

    if (operation === 'update' && originalDoc) {
      const origInv = originalDoc.inventorySqm !== undefined ? roundToTwoDecimals(Number(originalDoc.inventorySqm)) : 0
      const isInventoryChanged = Math.abs(rounded - origInv) > 0.001

      if (isInventoryChanged) {
        if (stockMode === 'normal') {
          throw new Error('ویرایش مستقیم موجودی در حالت عادی غیرفعال است. لطفاً حالت نگهداری (manual یا import) را فعال کنید.')
        }
        if (stockMode === 'manual' && isImportContext) {
          throw new Error('در حالت manual امکان اجرای ایمپورت دسته‌ای وجود ندارد.')
        }
        if (stockMode === 'import' && !isImportContext) {
          throw new Error('در حالت import ویرایش دستی موجودی از طریق فرم مجاز نیست.')
        }
      }
    } else if (operation === 'create') {
      if (rounded > 0 && stockMode === 'normal') {
        throw new Error('ثبت محصول جدید با موجودی اولیه در حالت عادی غیرفعال است. ابتدا محصول را با موجودی صفر ایجاد کنید.')
      }
    }
  }

  // 4. Packaging modification guard: Check if open reservations exist before modifying sqmPerCarton or piecesPerCarton
  if (operation === 'update' && originalDoc) {
    const origSqm = roundToTwoDecimals(Number(originalDoc.sqmPerCarton ?? 0))
    const newSqm = data.sqmPerCarton !== undefined ? roundToTwoDecimals(Number(data.sqmPerCarton)) : origSqm
    const origPieces = Number(originalDoc.piecesPerCarton ?? 4)
    const newPieces = data.piecesPerCarton !== undefined ? Number(data.piecesPerCarton) : origPieces

    const isPackagingChanged = Math.abs(origSqm - newSqm) > 0.001 || origPieces !== newPieces
    if (isPackagingChanged) {
      // Query if any open orders (status 'pending') reference this product
      const productId = originalDoc.id
      const pendingOrders = await req.payload.find({
        collection: 'orders',
        where: {
          and: [
            { 'items.product': { equals: productId } },
            { status: { in: ['pending', 'approve'] } },
          ],
        },
        limit: 1,
        depth: 0,
        req,
      })
      if (pendingOrders.totalDocs > 0) {
        throw new Error('تغییر ضریب بسته‌بندی یا تعداد در کارتن برای محصولی که سفارش باز دارد مجاز نیست.')
      }
    }
  }

  // 5. Always derive stockCartons from authoritative inventorySqm and sqmPerCarton
  const activeSqmPerCarton = data.sqmPerCarton !== undefined
    ? Number(data.sqmPerCarton)
    : (originalDoc?.sqmPerCarton !== undefined ? Number(originalDoc.sqmPerCarton) : 1.44)

  const activeInventorySqm = data.inventorySqm !== undefined
    ? Number(data.inventorySqm)
    : (originalDoc?.inventorySqm !== undefined ? Number(originalDoc.inventorySqm) : 0)

  data.stockCartons = calculateStockCartons(activeInventorySqm, activeSqmPerCarton)

  // 6. Sync width and height from dimension relationship
  if (data.dimension) {
    const dimensionId =
      typeof data.dimension === 'object' && data.dimension !== null
        ? (data.dimension as any).id
        : data.dimension

    if (dimensionId) {
      try {
        const dimDoc = await req.payload.findByID({
          collection: 'dimensions',
          id: dimensionId,
          depth: 0,
          req,
        })
        if (dimDoc) {
          data.width = (dimDoc as any).width
          data.height = (dimDoc as any).height
        }
      } catch {
        // Fallback: leave existing width/height
      }
    }
  }

  return data
}
