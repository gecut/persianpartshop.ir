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

export type StockWriteMode = 'normal' | 'manual' | 'import'

export function getStockWriteMode(): StockWriteMode {
  const mode = process.env.CMS_STOCK_WRITE_MODE?.trim().toLowerCase()
  if (mode === 'manual' || mode === 'import') {
    return mode
  }
  return 'normal'
}
