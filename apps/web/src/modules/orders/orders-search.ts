import type { OrderStatus } from '@persianpart/contract'

export const validateActivityFeedSearch = (search: Record<string, unknown>): {
  filter?: 'all' | 'order' | 'supply'
  orderStatus?: OrderStatus
  view?: 'supply'
  requestId?: number
} => ({
  filter:
    search.filter === 'order' || search.filter === 'supply'
      ? search.filter
      : search.view === 'supply'
        ? 'supply'
        : 'all',
  orderStatus:
    typeof search.orderStatus === 'string' &&
    ['pending', 'completed', 'cancel'].includes(search.orderStatus)
      ? (search.orderStatus as OrderStatus)
      : undefined,
  view: search.view === 'supply' ? 'supply' : undefined,
  requestId:
    /^[1-9]\d*$/.test(String(search.requestId ?? '')) &&
    Number.isSafeInteger(Number(search.requestId))
      ? Number(search.requestId)
      : undefined,
})
