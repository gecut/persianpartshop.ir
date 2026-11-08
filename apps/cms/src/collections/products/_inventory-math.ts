export function roundToTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateStockCartons(inventorySqm: number, sqmPerCarton: number): number {
  if (!Number.isFinite(inventorySqm) || !Number.isFinite(sqmPerCarton) || sqmPerCarton <= 0 || inventorySqm <= 0) {
    return 0
  }
  // Decimal-safe division: (inventorySqm * 10000) / (sqmPerCarton * 10000) avoids binary float precision artifacts
  const invScaled = Math.round(inventorySqm * 10000)
  const sqmScaled = Math.round(sqmPerCarton * 10000)
  if (sqmScaled <= 0) return 0
  return Math.floor(invScaled / sqmScaled)
}

export function calculateBasePricePerCarton(basePricePerSqm: number, sqmPerCarton: number): number {
  if (!Number.isFinite(basePricePerSqm) || !Number.isFinite(sqmPerCarton) || basePricePerSqm <= 0 || sqmPerCarton <= 0) {
    return 0
  }
  return Math.round(basePricePerSqm * sqmPerCarton)
}

export function getSalesFactor(product: { productType?: string | null; sqmPerCarton?: number | null }): number {
  if (product.productType === 'other') return 1
  const factor = Number(product.sqmPerCarton)
  if (!Number.isFinite(factor) || factor < 0.01) throw new Error('متراژ کارتن محصول کاشی معتبر نیست.')
  return roundToTwoDecimals(factor)
}

/** Computes an estimate without changing the existing order calculation. */
export function calculateSupplyEstimate(input: {
  requestedQuantity: number
  salesFactor: number
  basePrice: number
  markupPercent: number
}): { packageCount: number; roundedQuantity: number; estimatedUnitPrice: number; estimatedTotal: number } {
  const { requestedQuantity, salesFactor, basePrice, markupPercent } = input
  const toHundredths = (value: number): number => {
    const scaled = value * 100
    if (!Number.isFinite(value) || value <= 0 || Math.round(scaled) < 1 || !Number.isSafeInteger(Math.round(scaled)) ||
      Math.abs(scaled - Math.round(scaled)) > 1e-7) throw new Error('مقدار باید عدد مثبت با حداکثر دو رقم اعشار باشد.')
    return Math.round(scaled)
  }
  const quantity = toHundredths(requestedQuantity)
  const factor = toHundredths(salesFactor)
  if (requestedQuantity > 1_000_000 || !Number.isSafeInteger(basePrice) || basePrice < 0 ||
    !Number.isFinite(markupPercent)) throw new Error('اطلاعات مقدار یا قیمت معتبر نیست.')
  const packageCount = Math.ceil(quantity / factor)
  const roundedHundredths = packageCount * factor
  const estimatedUnitPrice = Math.round(basePrice * (1 + markupPercent / 100))
  if (![packageCount, roundedHundredths, estimatedUnitPrice].every(Number.isSafeInteger) || estimatedUnitPrice < 0) throw new Error('مقدار یا قیمت خارج از محدوده مجاز است.')
  const exactTotal = (BigInt(roundedHundredths) * BigInt(estimatedUnitPrice) + 50n) / 100n
  if (exactTotal > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('مقدار یا قیمت خارج از محدوده مجاز است.')
  const estimatedTotal = Number(exactTotal)
  return { packageCount, roundedQuantity: roundedHundredths / 100, estimatedUnitPrice, estimatedTotal }
}
