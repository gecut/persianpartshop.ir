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
