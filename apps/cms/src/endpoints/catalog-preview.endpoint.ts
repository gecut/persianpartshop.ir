import type { Endpoint } from 'payload'
import { CatalogPreviewInputSchema, CatalogLocationSchema } from '@persianpart/contract/public-catalog'
import { getAdminUser } from '../access/roles'
import { createCatalogService } from '../modules/catalog/catalog-service'

export const catalogPreviewEndpoint: Endpoint = {
  path: '/catalog-preview', method: 'post',
  handler: async req => {
    const actor = getAdminUser(req.user)
    if (!actor || !['manager', 'superadmin'].includes(actor.role)) return Response.json({ error: 'دسترسی پیش‌نمایش مجاز نیست.' }, { status: 403 })
    const input = CatalogPreviewInputSchema.safeParse(await req.json?.())
    if (!input.success) return Response.json({ error: 'تنظیمات معتبر نیستند.' }, { status: 400 })
    try {
      const result = await createCatalogService(req).preview(input.data.settings, input.data.productId)
      return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch { return Response.json({ error: 'دریافت پیش‌نمایش ممکن نشد.' }, { status: 503 }) }
  },
}

export const catalogLocationEndpoint: Endpoint = {
  path: '/catalog-location', method: 'get',
  handler: async req => {
    const actor = getAdminUser(req.user)
    if (!actor || !['manager', 'superadmin'].includes(actor.role)) return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    const result = CatalogLocationSchema.safeParse({ url: process.env.CATALOG_URL })
    if (!result.success) return Response.json({ error: 'نشانی کاتالوگ در تنظیمات استقرار مشخص نشده است.' }, { status: 503 })
    return Response.json(result.data, { headers: { 'Cache-Control': 'private, no-store' } })
  },
}
