import type { Product } from "../../types";
import { calculateCartonRequirement } from "../../lib/utils/math";

export interface CartTotals {
  totalCartons: number;
  totalDeliverableArea: number;
  totalPrice: number;
  hasValidQuantities: boolean;
}

export function computeCartTotals(
  products: Product[],
  quantities: Record<string, number>,
): CartTotals {
  let totalCartons = 0;
  let totalDeliverableArea = 0;
  let totalPrice = 0;

  products.forEach((product) => {
    const maxInventory = product.inventorySqm > 0 ? product.inventorySqm : 500;
    const area = Math.max(1, quantities[product.id] ?? 1);
    const calc = calculateCartonRequirement(
      area,
      product.sqmPerCarton,
      product.finalCustomerPricePerSqm,
      maxInventory,
    );
    totalCartons += calc.cartonCount;
    totalDeliverableArea += calc.deliverableArea;
    totalPrice += calc.totalPrice;
  });

  return {
    totalCartons,
    totalDeliverableArea: Math.round(totalDeliverableArea * 100) / 100,
    totalPrice,
    hasValidQuantities:
      products.length > 0 &&
      products.every((p) => (quantities[p.id] ?? 0) >= 1),
  };
}
