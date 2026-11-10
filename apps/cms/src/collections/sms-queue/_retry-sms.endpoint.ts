import type { Endpoint } from 'payload'
import { getAdminUser } from '../../access/roles'

export const retrySmsEndpoint: Endpoint = {
  path: '/:id/retry',
  method: 'post',
  handler: async req => {
    const actor = getAdminUser(req.user)
    if (!actor || !['superadmin', 'manager'].includes(actor.role)) {
      return Response.json({ error: 'دسترسی مجاز نیست.' }, { status: 403 })
    }

    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id <= 0) {
      return Response.json({ error: 'شناسه نامعتبر است.' }, { status: 400 })
    }

    const doc = await req.payload.findByID({
      collection: 'sms-queue',
      id,
      depth: 0,
      req,
      overrideAccess: true,
    })

    if (!doc) {
      return Response.json({ error: 'پیامک مورد نظر یافت نشد.' }, { status: 404 })
    }

    if (doc.status !== 'failed') {
      return Response.json({ error: 'تنها پیامک‌های ناموفق قابل ارسال مجدد هستند.' }, { status: 400 })
    }

    await req.payload.update({
      collection: 'sms-queue',
      id,
      data: {
        status: 'pending',
        attempts: 0,
        nextRetryAt: null,
        lastError: null,
      },
      req,
      overrideAccess: true,
    })

    return Response.json({ success: true, message: 'پیامک مجدداً در صف ارسال قرار گرفت.' })
  },
}
