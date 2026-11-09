import { toPersianDigits } from "@/lib/utils/currency";
import type { Product } from "@/modules/products/product-types";

// Plan products come from untyped API documents, so `dimension` may be an object at runtime.
interface DimensionObject {
  name?: string | number;
  width?: number;
  height?: number;
}

export function formatProdDimension(prod: Pick<Product, "dimension" | "dimensions"> | null | undefined): string {
  if (!prod) return "";
  const d: unknown = prod.dimension;
  if (typeof d === "object" && d !== null) {
    const { name, width, height } = d as DimensionObject;
    if (name) {
      return toPersianDigits(String(name).replace(/x/gi, " × "));
    }
    if (width && height) {
      return `${toPersianDigits(width)} × ${toPersianDigits(height)}`;
    }
  }
  if (
    typeof d === "string" &&
    d.trim() &&
    d !== "[object Object]" &&
    !d.includes("object Object")
  ) {
    return toPersianDigits(d.replace(/x/gi, " × "));
  }
  if (prod.dimensions?.width && prod.dimensions?.height) {
    return `${toPersianDigits(prod.dimensions.width)} × ${toPersianDigits(prod.dimensions.height)}`;
  }
  return "";
}
