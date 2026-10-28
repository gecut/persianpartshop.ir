import type { CollectionBeforeValidateHook } from 'payload'
import { calculateStockCartons, roundToTwoDecimals } from './_inventory-math'

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

  // 3. Validate and normalize inventorySqm. It is an absolute authoritative value
  // (already settled against orders by the time it is announced), so it is written
  // as-is whenever supplied, with no maintenance-window gate.
  if (data.inventorySqm !== undefined && data.inventorySqm !== null) {
    const incomingInventory = Number(data.inventorySqm)
    if (!Number.isFinite(incomingInventory) || incomingInventory < 0) {
      throw new Error('موجودی متراژ باید یک عدد نامنفی و متناهی باشد.')
    }
    // Check decimal precision (at most 2 decimal places)
    const rounded = roundToTwoDecimals(incomingInventory)
    if (Math.abs(incomingInventory - rounded) > 0.0001) {
      throw new Error('دقت اعشار موجودی متراژ حداکثر ۲ رقم اعشار است.')
    }
    data.inventorySqm = rounded
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

  // 5. stockCartons is derived and never trusted from the client. Recompute only when
  // one of its real inputs is part of this write; otherwise leave it untouched so an
  // unrelated edit (name, media, ...) cannot revert a concurrent order deduction.
  delete data.stockCartons
  if (data.inventorySqm !== undefined || data.sqmPerCarton !== undefined) {
    const activeSqmPerCarton = data.sqmPerCarton !== undefined
      ? Number(data.sqmPerCarton)
      : (originalDoc?.sqmPerCarton !== undefined ? Number(originalDoc.sqmPerCarton) : 1.44)

    const activeInventorySqm = data.inventorySqm !== undefined
      ? Number(data.inventorySqm)
      : (originalDoc?.inventorySqm !== undefined ? Number(originalDoc.inventorySqm) : 0)

    data.stockCartons = calculateStockCartons(activeInventorySqm, activeSqmPerCarton)
  }

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
