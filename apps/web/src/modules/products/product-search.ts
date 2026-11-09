export const validateProductListSearch = (
  search: Record<string, unknown>,
): { productId?: number; productname?: string } => ({
  ...search,
  productId:
    (typeof search.productId === "string" ||
      typeof search.productId === "number") &&
    /^[1-9]\d*$/.test(String(search.productId))
      ? Number(search.productId)
      : undefined,
})
