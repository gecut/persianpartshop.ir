export type DirtyKey = `${number}:${number}`

export type DirtyState = {
  amounts: Record<DirtyKey, string>
  inquiry: Record<DirtyKey, boolean>
}

export const emptyDirty: DirtyState = {
  amounts: {},
  inquiry: {},
}

export function dirtyKey(productId: number, warehouseId: number): DirtyKey {
  return `${productId}:${warehouseId}`
}

function normalizeDigits(text: string): string {
  return text
    .trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace('٫', '.')
}

export function parseAmount(text: string): number | null {
  const normalized = normalizeDigits(text)
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value <= 1_000_000_000 ? value : null
}

export function setAmount(
  state: DirtyState,
  key: DirtyKey,
  text: string,
  original: number | null,
): DirtyState {
  const trimmed = text.trim()
  const reverted = original === null ? trimmed === '' : trimmed !== '' && parseAmount(trimmed) === original
  if (reverted) {
    if (!(key in state.amounts)) return state
    const amounts = { ...state.amounts }
    delete amounts[key]
    return { ...state, amounts }
  }
  return { ...state, amounts: { ...state.amounts, [key]: text } }
}

export function setInquiry(
  state: DirtyState,
  key: DirtyKey,
  checked: boolean,
  original: boolean,
): DirtyState {
  if (checked === original) {
    if (!(key in state.inquiry)) return state
    const inquiry = { ...state.inquiry }
    delete inquiry[key]
    return { ...state, inquiry }
  }
  return { ...state, inquiry: { ...state.inquiry, [key]: checked } }
}

export function hasDirty(state: DirtyState): boolean {
  return Object.keys(state.amounts).length > 0 || Object.keys(state.inquiry).length > 0
}

export function inquiryBatches(
  state: DirtyState,
): { warehouseId: number; changes: { productId: number; enabled: boolean }[] }[] {
  const byWarehouse = new Map<number, { productId: number; enabled: boolean }[]>()
  for (const [rawKey, enabled] of Object.entries(state.inquiry) as [DirtyKey, boolean][]) {
    const [productIdText, warehouseIdText] = rawKey.split(':')
    const productId = Number(productIdText)
    const warehouseId = Number(warehouseIdText)
    const list = byWarehouse.get(warehouseId)
    if (list) list.push({ productId, enabled })
    else byWarehouse.set(warehouseId, [{ productId, enabled }])
  }

  const warehouseIds = [...byWarehouse.keys()].sort((a, b) => a - b)
  const batches: { warehouseId: number; changes: { productId: number; enabled: boolean }[] }[] = []
  for (const warehouseId of warehouseIds) {
    const sorted = byWarehouse.get(warehouseId)!.sort((a, b) => a.productId - b.productId)
    for (let i = 0; i < sorted.length; i += 500) {
      batches.push({ warehouseId, changes: sorted.slice(i, i + 500) })
    }
  }
  return batches
}
