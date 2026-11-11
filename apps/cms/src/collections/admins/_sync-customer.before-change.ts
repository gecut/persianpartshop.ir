import type { CollectionBeforeChangeHook } from 'payload'
import { businessError, fieldError, relationId } from '../../lib/validation'

export const syncAdminCustomer: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data.phone != null && data.phone !== '') {
    data.phone = String(data.phone).trim().replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    if (!/^09\d{9}$/.test(data.phone)) fieldError('phone', 'شماره همراه باید با ۰۹ آغاز شود و یازده رقم باشد.')
  }
  const effective = { ...originalDoc, ...data }
  if (effective.role === 'support' || effective.role === 'service') return data
  try {
    const linkedId = relationId(effective.customer)
    if (linkedId != null) {
      const customer = await req.payload.findByID({ collection: 'users', id: Number(linkedId), depth: 0, req })
      await req.payload.update({
        collection: 'users', id: customer.id, req,
        data: { fullName: effective.name, ...(effective.isActive === false ? { status: 'suspended' as const } : {}) },
        context: { skipLogging: true },
      })
    } else if (effective.phone && !originalDoc?.customer) {
      const existing = await req.payload.find({ collection: 'users', where: { phone: { equals: effective.phone } }, limit: 1, depth: 0, req })
      // Matching a phone is not proof of account ownership. Existing customers require an explicit link.
      if (existing.totalDocs) return data
      const tiers = await req.payload.find({ collection: 'customer-types', sort: 'id', limit: 1, depth: 0, req })
      const tier = tiers.docs[0] ?? await req.payload.create({ collection: 'customer-types', req, data: { name: 'مشتری عادی', slug: 'regular', markupPercent: 0, isActive: true } })
      const customer = await req.payload.create({
        collection: 'users', req,
        data: {
          fullName: effective.name,
          phone: effective.phone,
          customerType: tier.id,
          status: effective.isActive === false ? 'suspended' : 'active',
          showProductImageWatermark: false,
        },
        context: { skipLogging: true },
      })
      data.customer = customer.id
    }
  } catch (cause) {
    req.payload.logger.error({ err: cause, msg: 'Admin/customer synchronization failed' })
    throw businessError('همگام‌سازی حساب مشتری مرتبط انجام نشد؛ ارتباط حساب و اطلاعات مشتری را بررسی کنید.', 'CUSTOMER_SYNC_FAILED')
  }
  return data
}
