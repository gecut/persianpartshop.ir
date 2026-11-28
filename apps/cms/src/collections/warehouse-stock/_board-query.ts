import { StockBoardFilterSchema, StockInquiryUpdateInputSchema, type StockBoardFilter } from '@persianpart/contract'

export type BoardQuery = {
  q: string
  category: number | null
  brand: number | null
  filter: StockBoardFilter
  page: number
  limit: 25 | 50 | 100
}

function parseIntInRange(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

function parseOptionalPositiveId(raw: string | null): number | null | undefined {
  if (raw === null) return null
  return parseIntInRange(raw, 1, Number.MAX_SAFE_INTEGER) ?? undefined
}

export function parseBoardQuery(params: URLSearchParams): BoardQuery | null {
  const q = (params.get('q') ?? '').trim()
  if (q.length > 100) return null

  const category = parseOptionalPositiveId(params.get('category'))
  if (category === undefined) return null

  const brand = parseOptionalPositiveId(params.get('brand'))
  if (brand === undefined) return null

  const rawFilter = params.get('filter')
  const filter = rawFilter === null ? 'all' : StockBoardFilterSchema.safeParse(rawFilter).data
  if (!filter) return null

  const rawPage = params.get('page')
  const page = rawPage === null ? 1 : parseIntInRange(rawPage, 1, 100_000)
  if (page === null) return null

  const rawLimit = params.get('limit')
  const limit = rawLimit === null ? 50 : parseIntInRange(rawLimit, 25, 100)
  if (limit !== 25 && limit !== 50 && limit !== 100) return null

  return { q, category, brand, filter, page, limit }
}

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&')
}

export function parseInquiryBody(
  body: unknown,
): { warehouseId: number; changes: { productId: number; enabled: boolean }[] } | null {
  const parsed = StockInquiryUpdateInputSchema.safeParse(body)
  if (!parsed.success) return null
  return {
    warehouseId: parsed.data.warehouseId,
    changes: [...parsed.data.changes].sort((a, b) => a.productId - b.productId),
  }
}
