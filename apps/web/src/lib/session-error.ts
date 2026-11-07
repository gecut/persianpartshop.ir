function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
export function isSessionError(error: unknown) {
  const outer = record(error)
  const nested = record(outer.error)
  const data = record(outer.data)
  const nestedData = record(nested.data)
  return outer.code === 'UNAUTHORIZED' || nested.code === 'UNAUTHORIZED' || outer.status === 401 || data.code === 'USER_BANNED' || nestedData.code === 'USER_BANNED'
}
