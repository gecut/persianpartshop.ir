import 'server-only'
import { PayloadSDKError } from '@payloadcms/sdk'
import { readCatalogCMS } from '@/lib/catalog-cms'

const TOKEN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

export function cleanToken(raw: string): string | null {
  const token = raw.trim().toUpperCase()
  return TOKEN.test(token) ? token : null
}

export function isQrInactive(error: unknown): boolean {
  return (
    error instanceof PayloadSDKError &&
    error.status === 404 &&
    error.errors.some((item) => !!item && typeof item === 'object' && 'code' in item && item.code === 'QR_INACTIVE')
  )
}

export async function resolveQrTarget(
  raw: string,
  read: (token: string) => Promise<{ productId: number }> = (token) => readCatalogCMS('qr', { token }, { cache: 'no-store' }),
  isInactive: (error: unknown) => boolean = isQrInactive,
): Promise<{ kind: 'product'; id: number } | { kind: 'inactive' }> {
  const token = cleanToken(raw)
  if (!token) return { kind: 'inactive' }
  try {
    return { kind: 'product', id: (await read(token)).productId }
  } catch (error) {
    if (isInactive(error)) return { kind: 'inactive' }
    throw error
  }
}
