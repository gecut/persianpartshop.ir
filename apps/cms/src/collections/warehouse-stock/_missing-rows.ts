export type MissingBalance = {
  productId: number
  sku: string
  name: string
  productUpdatedAt: string
  inventorySqm: number
  revision: number
}

export function computeMissingRows(input: {
  fileSkus: ReadonlySet<string>
  balances: readonly MissingBalance[]
}): MissingBalance[] {
  return input.balances
    .filter((balance) => balance.inventorySqm > 0 && !input.fileSkus.has(balance.sku))
    .sort((a, b) => a.productId - b.productId)
}
