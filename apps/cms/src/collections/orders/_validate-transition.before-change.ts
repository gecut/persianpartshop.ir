import type { CollectionBeforeChangeHook } from 'payload'
import { businessError, fieldError, sameRelation } from '../../lib/validation'

const cancelled = (status: string) => ['cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'].includes(status)
const itemFields = ['id', 'productType', 'unit', 'salesFactor', 'cartonsPerPallet', 'productName', 'productSku', 'requestedArea', 'cartonCount', 'deliverableArea', 'unitPrice', 'totalPrice']

function sameItems(incoming: unknown, stored: unknown): boolean {
  if (!Array.isArray(incoming) || !Array.isArray(stored) || incoming.length !== stored.length) return false
  return incoming.every((item, index) => {
    const old = stored[index]
    if (!item || !old || !sameRelation(item.product, old.product)) return false
    return itemFields.every(key => (item[key] ?? null) === (old[key] ?? null))
  })
}

function sameTimestamp(incoming: unknown, stored: unknown): boolean {
  if (incoming == null || incoming === '') return stored == null || stored === ''
  if (!(typeof incoming === 'string' || incoming instanceof Date) || !(typeof stored === 'string' || stored instanceof Date)) return false
  const time = new Date(incoming).getTime()
  return Number.isFinite(time) && time === new Date(stored).getTime()
}

function sameEvent(incoming: unknown, stored: unknown): boolean {
  if (!incoming || !stored || typeof incoming !== 'object' || typeof stored !== 'object' || Array.isArray(incoming) || Array.isArray(stored)) return false
  const status = 'status' in incoming ? incoming.status : null
  const oldStatus = 'status' in stored ? stored.status : null
  return (status ?? '') === (oldStatus ?? '') && sameTimestamp(
    'timestamp' in incoming ? incoming.timestamp : null,
    'timestamp' in stored ? stored.timestamp : null,
  )
}

function sameTimeline(incoming: unknown, stored: unknown): boolean {
  const old = stored ?? []
  if (incoming == null && Array.isArray(old) && old.length === 0) return true
  // Form-generated row IDs and equivalent date serializations are not history edits.
  return Array.isArray(incoming) && Array.isArray(old) && incoming.length === old.length && incoming.every((entry, i) => sameEvent(entry, old[i]))
}

export const validateTransitionBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  if (operation === 'create') {
    if (data.status && data.status !== 'pending') fieldError('status', 'سفارش جدید فقط در وضعیت ثبت‌شده ایجاد می‌شود.')
    data.status = 'pending'
    data.cancelledBy = null
    data.timeline = [{ timestamp: new Date().toISOString(), status: 'pending' }]
    return data
  }
  if (!originalDoc) throw new Error('Missing original order')
  for (const key of ['user', 'warehouse']) {
    if (data[key] !== undefined && !sameRelation(data[key], originalDoc[key])) fieldError(key, 'مشتری و انبار سفارش پس از ثبت قابل تغییر نیستند.')
  }
  for (const key of ['createdAt', 'trackingNumber', 'orderNumber', 'idempotencyKey', 'requestFingerprint', 'warehouseName', 'warehouseCode', 'subtotal', 'discountAmount', 'taxAmount', 'finalTotal']) {
    if (data[key] !== undefined && (data[key] ?? null) !== (originalDoc[key] ?? null)) fieldError(key, 'این مقدار پس از ثبت سفارش قابل تغییر نیست.')
  }
  if (data.items !== undefined && !sameItems(data.items, originalDoc.items)) fieldError('items', 'ویرایش اقلام سفارش پس از ثبت ممنوع است؛ سفارش را لغو و مجدداً ثبت کنید.')
  if (data.timeline !== undefined) {
    if (!sameTimeline(data.timeline, originalDoc.timeline)) fieldError('timeline', 'گاه‌شمار سفارش فقط توسط سامانه ثبت می‌شود.')
    // Never persist the client echo, including its row IDs and timestamp representation.
    data.timeline = originalDoc.timeline
  }
  const from = originalDoc.status
  let to = data.status === undefined ? from : data.status
  if (to === 'cancel' && from !== 'cancel') to = data.cancelledBy === 'customer' ? 'cancelled_by_customer' : 'cancelled_by_admin'
  const terminal = from === 'completed' || cancelled(from)
  const allowed = terminal ? [from] : from === 'pending'
    ? ['pending', 'approve', 'cancelled_by_customer', 'cancelled_by_admin']
    : from === 'approve' ? ['approve', 'completed', 'cancelled_by_admin'] : [from]
  if (!allowed.includes(to)) throw businessError('تغییر وضعیت انتخاب‌شده برای این سفارش مجاز نیست.', 'INVALID_STATUS_TRANSITION')
  if (terminal && data.deliveryAddress !== undefined && (data.deliveryAddress ?? '') !== (originalDoc.deliveryAddress ?? '')) fieldError('deliveryAddress', 'پس از تکمیل یا لغو سفارش فقط یادداشت قابل ویرایش است.')
  const changed = to !== from
  const actor = to === 'cancelled_by_customer' ? 'customer' : to === 'cancelled_by_admin' ? 'admin' : originalDoc.cancelledBy ?? null
  if (!changed && data.cancelledBy !== undefined && (data.cancelledBy ?? null) !== (originalDoc.cancelledBy ?? null)) fieldError('cancelledBy', 'مرجع لغو فقط هنگام لغو سفارش تعیین می‌شود.')
  data.status = to
  if (changed) {
    data.cancelledBy = cancelled(to) ? actor : null
    data.timeline = [...(originalDoc.timeline ?? []), { timestamp: new Date().toISOString(), status: to }]
  }
  return data
}
