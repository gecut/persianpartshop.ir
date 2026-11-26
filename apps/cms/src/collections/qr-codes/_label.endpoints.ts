import { initTransaction, commitTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'
import { zipSync } from 'fflate'
import { getAdminUser } from '../../access/roles'
import { renderLabel } from '../../modules/qr-label/render-label'
import { labelUrl } from '../../modules/qr-label/label-url'
import { canManageQr } from './_access'
import { pickFreshTokens } from './_pick-tokens'

const MAX_COUNT = 500
const forbidden = () => Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
const bad = (error: string, status = 400) => Response.json({ error }, { status })

export function parseGenerateBody(body: unknown): { count: number; store: string | null } | null {
  if (!body || typeof body !== 'object') return null
  const { count, store } = body as Record<string, unknown>
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_COUNT) return null
  if (store !== undefined && store !== null && typeof store !== 'string') return null
  const trimmed = typeof store === 'string' ? store.trim() : ''
  if (trimmed.length > 120) return null
  return { count, store: trimmed || null }
}

export function parseExportBody(body: unknown): number[] | null {
  if (!body || typeof body !== 'object') return null
  const { ids } = body as Record<string, unknown>
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_COUNT) return null
  if (!ids.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) return null
  return [...new Set(ids as number[])]
}

export function zipEntryName(store: string | null | undefined, token: string): string {
  const safe = (store ?? '')
    .replace(/\.\./g, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
  return `${safe || 'qr'}-${token}.png`
}

export function buildZip(entries: { name: string; png: Uint8Array }[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const entry of entries) files[entry.name] = [entry.png, { level: 0 }] // PNG is already compressed
  return zipSync(files)
}

const catalogUrl = () => process.env.CATALOG_URL ?? ''

async function renderToken(token: string) {
  return (await renderLabel(labelUrl(catalogUrl(), token))).png
}

const generate: Endpoint = {
  path: '/generate',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!canManageQr(req)) return forbidden()
    const input = parseGenerateBody(await req.json?.().catch(() => undefined))
    if (!input) return bad('تعداد یا نام فروشگاه معتبر نیست.')
    const transaction = await initTransaction(req)
    try {
      const tokens = await pickFreshTokens(input.count, async (candidates) => {
        const found = await req.payload.find({
          collection: 'qr-codes', where: { token: { in: candidates } }, limit: candidates.length,
          depth: 0, pagination: false, req, overrideAccess: false,
        })
        return new Set(found.docs.map((doc) => doc.token))
      })
      const ids: number[] = []
      for (const token of tokens) {
        const doc = await req.payload.create({
          collection: 'qr-codes', data: { token, store: input.store, isActive: true }, req, overrideAccess: false,
        })
        ids.push(doc.id)
      }
      if (transaction) await commitTransaction(req)
      return Response.json({ ids })
    } catch (error) {
      if (transaction) await killTransaction(req)
      req.payload.logger.error({ msg: 'QR generate failed', error: error instanceof Error ? error.message : 'unknown' })
      return bad('ساخت کدها ممکن نشد؛ دوباره تلاش کنید.', 500)
    }
  },
}

const exportZip: Endpoint = {
  path: '/export',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!canManageQr(req)) return forbidden()
    if (!catalogUrl()) return bad('آدرس کاتالوگ تنظیم نشده است.', 500)
    const ids = parseExportBody(await req.json?.().catch(() => undefined))
    if (!ids) return bad(`شناسه‌ها معتبر نیست؛ حداکثر ${MAX_COUNT} کد در هر خروجی مجاز است.`)
    const found = await req.payload.find({
      collection: 'qr-codes', where: { id: { in: ids } }, limit: ids.length, depth: 0, pagination: false, req, overrideAccess: false,
    })
    if (!found.docs.length) return bad('کدی با این شناسه‌ها پیدا نشد.', 404)
    const entries: { name: string; png: Uint8Array }[] = []
    for (const doc of found.docs) entries.push({ name: zipEntryName(doc.store, doc.token), png: await renderToken(doc.token) })
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    return new Response(buildZip(entries) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="qr-labels-${stamp}.zip"`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
}

const preview: Endpoint = {
  path: '/preview',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!getAdminUser(req.user)) return forbidden()
    if (!catalogUrl()) return bad('آدرس کاتالوگ تنظیم نشده است.', 500)
    const id = Number(new URL(req.url ?? 'http://localhost').searchParams.get('id'))
    if (!Number.isInteger(id) || id < 1) return bad('شناسه معتبر نیست.')
    const doc = await req.payload.findByID({ collection: 'qr-codes', id, depth: 0, req, overrideAccess: false }).catch(() => null)
    if (!doc) return bad('کد پیدا نشد.', 404)
    return new Response((await renderToken(doc.token)) as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
    })
  },
}

export const qrLabelEndpoints: Endpoint[] = [generate, exportZip, preview]
