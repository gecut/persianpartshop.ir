import type { CollectionAfterChangeHook } from 'payload'
import { SMS_TEMPLATES } from '../../modules/sms/constants'
import { enqueueSms } from '../../modules/sms/queue-service'
import { getNotificationSettings } from '../../globals/notification-settings.global'

export const notifyOrderAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.skipSms) return

  try {
    const isCreate = operation === 'create'
    const statusChanged = !isCreate && previousDoc && doc.status !== previousDoc.status
    const trackingToken = String(doc.trackingNumber ?? doc.orderNumber ?? doc.id)

    const settings = await getNotificationSettings(req.payload, req)
    if (!settings.enableOrderNotifications) return

    // Lookup user to get phone & fullName
    const userId = typeof doc.user === 'object' && doc.user !== null ? doc.user.id : doc.user
    let customerPhone = ''
    let customerName = 'مشتری'

    if (userId) {
      try {
        const userDoc = (await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          req,
          overrideAccess: true,
        })) as any
        customerPhone = userDoc?.phone || ''
        customerName = userDoc?.fullName || userDoc?.companyName || userDoc?.name || 'مشتری'
      } catch {
        // Fallback to defaults
      }
    }

    // 1. Create Operation
    if (isCreate) {
      // 1.a Notify customer
      if (customerPhone) {
        await enqueueSms(req.payload, {
          receptor: customerPhone,
          template: SMS_TEMPLATES.ORDER_REGISTERED,
          tokens: { token: trackingToken },
          req,
        })
      }

      // 1.b Notify admins
      if (settings.adminPhones.length > 0) {
        for (const adminPhone of settings.adminPhones) {
          await enqueueSms(req.payload, {
            receptor: adminPhone,
            template: SMS_TEMPLATES.ADMIN_NEW_ORDER,
            tokens: {
              token: trackingToken,
              token10: customerName,
            },
            req,
          })
        }
      }
      return
    }

    // 2. Status Transition Updates
    if (statusChanged) {
      // 2.a Order Approved
      if (doc.status === 'approve') {
        if (customerPhone) {
          await enqueueSms(req.payload, {
            receptor: customerPhone,
            template: SMS_TEMPLATES.ORDER_APPROVED,
            tokens: { token: trackingToken },
            req,
          })
        }
      }

      // 2.b Order Cancelled
      const isCancelled = ['cancelled_by_customer', 'cancelled_by_admin', 'cancel'].includes(doc.status)
      const wasCancelled = ['cancelled_by_customer', 'cancelled_by_admin', 'cancel'].includes(previousDoc?.status)

      if (isCancelled && !wasCancelled) {
        // Notify customer
        if (customerPhone) {
          await enqueueSms(req.payload, {
            receptor: customerPhone,
            template: SMS_TEMPLATES.ORDER_CANCELLED,
            tokens: { token: trackingToken },
            req,
          })
        }

        // Notify admins
        if (settings.adminPhones.length > 0) {
          for (const adminPhone of settings.adminPhones) {
            await enqueueSms(req.payload, {
              receptor: adminPhone,
              template: SMS_TEMPLATES.ADMIN_ORDER_CANCELLED,
              tokens: {
                token: trackingToken,
                token10: customerName,
              },
              req,
            })
          }
        }
      }
    }
  } catch (err) {
    req.payload.logger.error({ msg: '[OrderSMS] Error enqueueing order notification', err })
  }
}
