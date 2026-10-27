import type { CollectionBeforeValidateHook } from 'payload'

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

  // 2. Check Idempotency Key replay on creation (scoped to user)
  if (data.idempotencyKey) {
    const userId =
      typeof data.user === 'object' && data.user !== null ? (data.user as any).id : data.user

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
      throw new Error(`سفارش قبلاً با این کلید تکرار ثبت شده است (شماره سفارش: ${existingOrder.docs[0].orderNumber})`)
    }
  }

  // 3. Stable, collision-resistant orderNumber generation
  if (!data.orderNumber) {
    const timestamp = Date.now().toString().slice(-6)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    data.orderNumber = `ptp ${timestamp}${randomSuffix}`
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('سفارش باید حداقل شامل یک قلم کالا باشد.')
  }

  // 4. Resolve and validate customer tier markup
  let customerMarkupPercent = 0
  const userId =
    typeof data.user === 'object' && data.user !== null ? (data.user as any).id : data.user

  if (userId) {
    try {
      const userDoc = await req.payload.findByID({
        collection: 'users',
        id: userId,
        depth: 1,
        req,
      })
      if (!userDoc) {
        throw new Error('مشتری مورد نظر یافت نشد.')
      }
      if ((userDoc as any).status !== 'active') {
        throw new Error('حساب کاربری مشتری فعال نیست.')
      }
      if ((userDoc as any).customerType) {
        const ct = (userDoc as any).customerType
        if (typeof ct === 'object' && ct !== null && typeof ct.markupPercent === 'number') {
          customerMarkupPercent = ct.markupPercent
        }
      }
    } catch (err: any) {
      if (err instanceof Error && (err.message.includes('فعال نیست') || err.message.includes('یافت نشد'))) {
        throw err
      }
      throw new Error('اعتبارسنجی مشتری با خطا مواجه شد.')
    }
  }

  // 5. Consolidate duplicate products & calculate authoritatively
  const consolidatedMap = new Map<number, number>()
  for (const item of data.items) {
    const productId = Number(
      typeof item.product === 'object' && item.product !== null
        ? item.product.id
        : item.product,
    )
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new Error('شناسه محصول نامعتبر است.')
    }

    const area = Number(item.requestedArea)
    if (!Number.isFinite(area) || area <= 0) {
      throw new Error(`متراژ درخواستی نامعتبر است: ${item.requestedArea}`)
    }

    const current = consolidatedMap.get(productId) || 0
    const nextArea = current + area
    if (!Number.isFinite(nextArea) || nextArea > 1_000_000) {
      throw new Error(`متراژ تجمیعی بیش از حد مجاز است: ${nextArea}`)
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
  }> = []

  let calculatedSubtotal = 0

  for (const [productId, requestedArea] of consolidatedMap.entries()) {
    const productDoc = await req.payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      req,
    })

    if (!productDoc) {
      throw new Error(`محصول با شناسه ${productId} یافت نشد.`)
    }

    if ((productDoc as any).isActive === false) {
      throw new Error(`محصول ${(productDoc as any).name || productId} غیرفعال است.`)
    }

    const sqmPerCarton = Number((productDoc as any).sqmPerCarton)
    if (!Number.isFinite(sqmPerCarton) || sqmPerCarton <= 0) {
      throw new Error(`ضریب متراژ هر کارتن برای محصول ${productId} نامعتبر است.`)
    }

    const basePrice = Number((productDoc as any).basePricePerSqm)
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw new Error(`قیمت پایه برای محصول ${productId} نامعتبر است.`)
    }

    // Whole cartons only
    const cartonCount = Math.ceil(requestedArea / sqmPerCarton)
    if (!Number.isSafeInteger(cartonCount) || cartonCount <= 0) {
      throw new Error(`تعداد کارتن محاسبه‌شده برای ${productId} نامعتبر است.`)
    }

    // Exact deliverable area: cartonCount * sqmPerCarton rounded to 2 decimals
    const deliverableArea = Math.round(cartonCount * sqmPerCarton * 100) / 100

    // Unit price with customer tier markup: integer Tomans
    const unitPrice = Math.round(basePrice * (1 + customerMarkupPercent / 100))
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      throw new Error(`قیمت واحد محاسبه‌شده برای ${productId} نامعتبر است.`)
    }

    const totalPrice = Math.round(deliverableArea * unitPrice)
    if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
      throw new Error(`قیمت کل محاسبه‌شده برای ${productId} نامعتبر است.`)
    }

    consolidatedItems.push({
      product: productId,
      requestedArea,
      cartonCount,
      deliverableArea,
      unitPrice,
      totalPrice,
      productSku: (productDoc as any).sku,
      productName: (productDoc as any).name,
    })

    calculatedSubtotal += totalPrice
  }

  if (!Number.isSafeInteger(calculatedSubtotal) || calculatedSubtotal < 0) {
    throw new Error('جمع کل فاکتور خارج از محدوده مجاز است.')
  }

  data.items = consolidatedItems
  data.subtotal = calculatedSubtotal
  data.discountAmount = 0
  data.taxAmount = 0
  data.finalTotal = calculatedSubtotal

  return data
}
