import { ORPCError } from '@orpc/server'
import { sdk } from '../payload'

export interface CartonCalcInput {
  productId?: string | number
  sqmPerCarton?: number
  pricePerSqm?: number
  requestedArea?: number
  requestedSqm?: number
}

export interface CartonCalcResult {
  cartonCount: number
  deliverableArea: number
  totalPrice: number
}

/**
 * Calculates standard tile carton metrics:
 * cartonCount = ceil(requestedArea / sqmPerCarton)
 * deliverableArea = round(cartonCount * sqmPerCarton, 2)
 * totalPrice = round(deliverableArea * pricePerSqm)
 */
export async function calculateCartonMetrics(input: CartonCalcInput, markupPercent = 0): Promise<CartonCalcResult> {
  let sqmPerCarton = input.sqmPerCarton
  let pricePerSqm = input.pricePerSqm

  if (input.productId) {
    try {
      const prod: any = await sdk.findByID({ collection: 'products', id: input.productId })
      if (!prod) {
        throw new ORPCError('NOT_FOUND', { message: 'محصول مورد نظر یافت نشد.' })
      }
      sqmPerCarton = sqmPerCarton || prod.sqmPerCarton
      if (pricePerSqm === undefined) {
        // Apply customer tier markup; do not disclose raw base wholesale price
        pricePerSqm = Math.round((Number(prod.basePricePerSqm) || 0) * (1 + markupPercent / 100))
      }
    } catch (err) {
      if (err instanceof ORPCError) throw err
      throw new ORPCError('NOT_FOUND', { message: 'محصول مورد نظر یافت نشد.' })
    }
  }

  if (!sqmPerCarton || sqmPerCarton <= 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'متراژ هر کارتن (sqmPerCarton) الزامی و باید مقداری بزرگتر از صفر باشد.',
    })
  }

  const requestedArea = Math.max(0, input.requestedArea ?? input.requestedSqm ?? 0)
  const cartonCount = requestedArea > 0 ? Math.ceil(requestedArea / sqmPerCarton) : 0
  const deliverableArea = Math.round(cartonCount * sqmPerCarton * 100) / 100
  const totalPrice = Math.round(deliverableArea * (pricePerSqm || 0))

  return {
    cartonCount,
    deliverableArea,
    totalPrice,
  }
}
