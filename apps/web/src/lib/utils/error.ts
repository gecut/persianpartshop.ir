export function customerErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && /[\u0600-\u06ff]/.test(error.message) ? error.message : fallback
}
