export interface QrRow {
  token: string
  product?: number | { id: number } | null | undefined
  isActive?: boolean | null
}

export function qrProductId(product: QrRow['product']): number | null {
  if (typeof product === 'number') return product
  if (product && typeof product === 'object' && typeof product.id === 'number') return product.id
  return null
}

export function buildQrTokenMap(rows: readonly QrRow[], visibleProductIds: ReadonlySet<number>): Record<string, number> {
  const tokens: Record<string, number> = {}
  for (const row of rows) {
    if (row.isActive === false) continue
    const id = qrProductId(row.product)
    if (id === null || !visibleProductIds.has(id)) continue
    tokens[row.token.trim().toUpperCase()] = id
  }
  return tokens
}
