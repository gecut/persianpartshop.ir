// B2B Carton and Area Calculation Utilities conforming to PersianPart 2.0 Invariants

export interface CartonCalculationResult {
  requestedArea: number
  sqmPerCarton: number
  cartonCount: number
  deliverableArea: number
  extraArea: number
  unitPrice: number
  totalPrice: number
  isExactMultiple: boolean
  isExceedingStock: boolean
  maxDeliverableSqm: number
  errorMessage?: string
}

/**
 * Calculates carton count and actual deliverable area from required square meters
 * Invariant: Round-down is strictly prohibited in V1 (always Math.ceil).
 * Line total = deliverableArea * unitPrice
 */
export function calculateCartonRequirement(
  requestedArea: number,
  sqmPerCarton: number,
  pricePerSquareMeter: number,
  inventorySqm?: number
): CartonCalculationResult {
  const safeRequested = Math.max(0, requestedArea || 0)
  const safePerCarton = Math.max(0.001, sqmPerCarton || 1)
  const availableInventory = typeof inventorySqm === 'number' ? Math.max(0, inventorySqm) : Infinity

  if (safeRequested === 0) {
    return {
      requestedArea: 0,
      sqmPerCarton: safePerCarton,
      cartonCount: 0,
      deliverableArea: 0,
      extraArea: 0,
      unitPrice: pricePerSquareMeter,
      totalPrice: 0,
      isExactMultiple: true,
      isExceedingStock: false,
      maxDeliverableSqm: 0,
    }
  }

  // Calculate whole carton count rounded UP (ceil)
  const cartonCount = Math.max(1, Math.ceil(safeRequested / safePerCarton))
  // Actual deliverable square meters
  const deliverableArea = Math.round(cartonCount * safePerCarton * 100) / 100
  const extraArea = Math.max(0, Math.round((deliverableArea - safeRequested) * 100) / 100)
  const totalPrice = Math.round(deliverableArea * pricePerSquareMeter)
  const isExactMultiple = extraArea === 0

  // Inventory validation
  const isExceedingStock = deliverableArea > availableInventory
  const maxCartons = Math.floor(availableInventory / safePerCarton)
  const maxDeliverableSqm = Math.round(maxCartons * safePerCarton * 100) / 100

  let errorMessage: string | undefined
  if (isExceedingStock) {
    errorMessage = `موجودی کافی نیست. حداکثر مقدار قابل سفارش: ${maxDeliverableSqm} (${maxCartons} کارتن)`
  }

  return {
    requestedArea: safeRequested,
    sqmPerCarton: safePerCarton,
    cartonCount,
    deliverableArea,
    extraArea,
    unitPrice: pricePerSquareMeter,
    totalPrice,
    isExactMultiple,
    isExceedingStock,
    maxDeliverableSqm,
    errorMessage,
  }
}
