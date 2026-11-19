import { APIError, type Endpoint } from 'payload'
import { catalogOperations } from '@persianpart/contract/public-catalog'
import { getAdminUser } from '../access/roles'
import { createCatalogService } from '../modules/catalog/catalog-service'

export const catalogEndpoint: Endpoint = {
  path: '/catalog/:operation',
  method: 'post',
  handler: async (req) => {
    // Payload resolves the existing admins API key and account before this handler.
    const actor = getAdminUser(req.user)
    if (!actor || actor.role !== 'service')
      throw new APIError('دسترسی مجاز نیست.', 403)
    const operation = req.routeParams?.operation
    const body: unknown = await req.json?.().catch(() => undefined)
    const service = createCatalogService(req)
    try {
      switch (operation) {
        case 'bootstrap': {
          if (!catalogOperations.bootstrap.input.safeParse(body).success)
            throw new APIError('درخواست معتبر نیست.', 400)
          return Response.json(
            catalogOperations.bootstrap.output.parse(await service.bootstrap()),
            { headers: { 'Cache-Control': 'private, no-store' } },
          )
        }
        case 'browse': {
          const input = catalogOperations.browse.input.safeParse(body)
          if (!input.success) throw new APIError('فیلتر معتبر نیست.', 400)
          return Response.json(
            catalogOperations.browse.output.parse(
              await service.browse(input.data),
            ),
            { headers: { 'Cache-Control': 'private, no-store' } },
          )
        }
        case 'product': {
          const input = catalogOperations.product.input.safeParse(body)
          if (!input.success) throw new APIError('شناسه معتبر نیست.', 400)
          return Response.json(
            catalogOperations.product.output.parse(
              await service.product(input.data),
            ),
            { headers: { 'Cache-Control': 'private, no-store' } },
          )
        }
        default:
          throw new APIError('مسیر موجود نیست.', 404)
      }
    } catch (error) {
      if (error instanceof APIError) {
        return Response.json(
          {
            errors: [
              {
                message: error.message,
                ...(error.data && 'code' in error.data
                  ? { code: error.data.code }
                  : {}),
              },
            ],
          },
          {
            status: error.status,
            headers: { 'Cache-Control': 'private, no-store' },
          },
        )
      }
      req.payload.logger.error({ msg: 'Catalog read failed', operation })
      throw new APIError('دریافت کاتالوگ ممکن نشد؛ دوباره تلاش کنید.', 503)
    }
  },
}
