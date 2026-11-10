import { ORPCError } from '@orpc/server'

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined

export function payloadErrorDetails(error: unknown): { status: number; code?: string; message: string } {
  const source = record(error)
  const first = source && Array.isArray(source.errors) ? record(source.errors[0]) : undefined
  const data = record(first?.data) ?? record(source?.data)
  const fields = data && Array.isArray(data.errors) ? record(data.errors[0]) : undefined
  const status = typeof source?.status === 'number' ? source.status : 500
  const message = fields?.message ?? first?.message ?? source?.message
  return {
    status,
    code: typeof data?.code === 'string' ? data.code : undefined,
    message: status >= 400 && status < 500 && typeof message === 'string' ? message : 'ارتباط با سامانه مدیریت محتوا با خطا مواجه شد؛ دوباره تلاش کنید.',
  }
}

export function handlePayloadError(error: unknown): never {
  if (error instanceof ORPCError) throw error
  const detail = payloadErrorDetails(error)
  const codes: Record<string, string> = {
    INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK', STALE_ORDER: 'CONFLICT', STALE_STOCK: 'CONFLICT',
    INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION', CANNOT_CANCEL: 'CANNOT_CANCEL',
    SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE', EXACT_STOCK_AVAILABLE: 'EXACT_STOCK_AVAILABLE',
  }
  const code = detail.status >= 500 ? (detail.status === 503 || detail.status === 504 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR')
    : (detail.code && codes[detail.code]) || ({ 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT' } as Record<number, string>)[detail.status] || 'BAD_REQUEST'
  throw new ORPCError(code, { message: detail.message, data: { message: detail.message, code: detail.code ?? code } })
}
