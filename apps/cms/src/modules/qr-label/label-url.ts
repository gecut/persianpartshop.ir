import { normalizeToken } from '../../collections/qr-codes/_token'

export function labelUrl(catalogUrl: string, token: string): string {
  const normalized = normalizeToken(token)
  if (!normalized) throw new RangeError('Invalid QR token')
  return `${new URL(catalogUrl).origin}/Q/${normalized}`.toUpperCase()
}
