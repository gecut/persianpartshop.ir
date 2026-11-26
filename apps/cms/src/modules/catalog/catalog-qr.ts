import { APIError } from 'payload'
import { normalizeToken } from '../../collections/qr-codes/_token'

export interface QrRow {
  product?: number | { id: number } | null | undefined
  isActive?: boolean | null | undefined
}
export interface QrDeps {
  findByToken(token: string): Promise<QrRow | null>
  isPublished(productId: number): Promise<boolean>
}

const inactive = () => new APIError('کد QR فعال نیست.', 404, { code: 'QR_INACTIVE' })

export async function resolveQr(deps: QrDeps, rawToken: string): Promise<{ productId: number }> {
  const token = normalizeToken(rawToken)
  if (!token) throw inactive()
  const row = await deps.findByToken(token)
  if (!row || row.isActive === false) throw inactive()
  const productId = typeof row.product === 'object' && row.product ? row.product.id : row.product
  if (typeof productId !== 'number' || !(await deps.isPublished(productId))) throw inactive()
  return { productId }
}
