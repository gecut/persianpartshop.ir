import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/currency";
import type { Product } from "@/modules/products/product-types";

interface ProductStockValueProps {
  product: Product;
  unitLabel: ReactNode;
}

export function ProductStockValue({ product: activeProduct, unitLabel }: ProductStockValueProps) {
  return activeProduct.hideExactStock ? (
    <span
      className={cn(
        "text-right flex items-center justify-end font-bold text-xs leading-normal truncate",
        activeProduct.inStock
          ? "text-success"
          : "text-danger",
      )}
    >
      <span className="text-right">
        {activeProduct.inStock ? "موجود" : "ناموجود"}
      </span>
    </span>
  ) : (
    <span
      className="text-right flex items-center gap-0.5 justify-end font-bold text-foreground text-xs leading-normal truncate"
      dir="ltr"
    >
      <span>{unitLabel}</span>
      {toPersianDigits(
        activeProduct.inventorySqm || 0,
      )}
    </span>
  );
}
