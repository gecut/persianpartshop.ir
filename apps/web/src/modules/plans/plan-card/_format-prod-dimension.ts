import { toPersianDigits } from "@/lib/utils/currency";

export function formatProdDimension(prod: any): string {
  if (!prod) return "";
  const d = prod.dimension;
  if (typeof d === "object" && d !== null) {
    if (d.name) {
      return toPersianDigits(String(d.name).replace(/x/gi, " × "));
    }
    if (d.width && d.height) {
      return `${toPersianDigits(d.width)} × ${toPersianDigits(d.height)}`;
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
