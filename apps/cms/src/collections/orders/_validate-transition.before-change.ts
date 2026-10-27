import type { CollectionBeforeChangeHook } from 'payload'

const isCancelled = (s?: string) =>
  s === 'cancel' ||
  s === 'cancelled' ||
  s === 'cancelled_by_customer' ||
  s === 'cancelled_by_admin'

export const validateTransitionBeforeChange: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
}) => {
  if (operation === 'create') {
    if (data.status && data.status !== 'pending') {
      throw new Error('سفارش جدید فقط می‌تواند در وضعیت "pending" ایجاد شود.')
    }
  }

  if (operation === 'update' && originalDoc) {
    const fromStatus = originalDoc.status
    const toStatus = data.status || fromStatus

    // Immutable items and financial amounts after creation
    if (data.items && JSON.stringify(data.items) !== JSON.stringify(originalDoc.items)) {
      throw new Error('ویرایش اقلام سفارش پس از ثبت ممنوع است. برای تغییر، سفارش را لغو و مجدداً ثبت نمایید.')
    }
    if (data.subtotal !== undefined && data.subtotal !== originalDoc.subtotal) {
      throw new Error('ویرایش مبالغ مالی سفارش پس از ثبت ممنوع است.')
    }
    if (data.discountAmount !== undefined && data.discountAmount !== originalDoc.discountAmount) {
      throw new Error('ویرایش مبالغ مالی سفارش پس از ثبت ممنوع است.')
    }
    if (data.taxAmount !== undefined && data.taxAmount !== originalDoc.taxAmount) {
      throw new Error('ویرایش مبالغ مالی سفارش پس از ثبت ممنوع است.')
    }
    if (data.finalTotal !== undefined && data.finalTotal !== originalDoc.finalTotal) {
      throw new Error('ویرایش مبالغ مالی سفارش پس از ثبت ممنوع است.')
    }
    if (data.orderNumber && data.orderNumber !== originalDoc.orderNumber) {
      throw new Error('تغییر شماره سفارش ممنوع است.')
    }
    if (data.idempotencyKey && data.idempotencyKey !== originalDoc.idempotencyKey) {
      throw new Error('تغییر کلید تکرار سفارش ممنوع است.')
    }
    if (data.user && String(data.user) !== String(typeof originalDoc.user === 'object' && originalDoc.user ? originalDoc.user.id : originalDoc.user)) {
      throw new Error('تغییر مشتری سفارش ممنوع است.')
    }

    // Terminal statuses cannot transition: cancelled or completed
    if (isCancelled(fromStatus)) {
      throw new Error('سفارش لغو شده در وضعیت پایانی است و قابل بازگشایی یا تغییر وضعیت نیست.')
    }
    if (fromStatus === 'completed') {
      throw new Error('سفارش تکمیل شده در وضعیت نهایی است و قابل تغییر نیست.')
    }

    // Allowed transitions from pending:
    // pending -> approve
    // pending -> cancelled_by_customer | cancelled_by_admin | cancel
    if (fromStatus === 'pending') {
      const allowed = ['pending', 'approve', 'cancelled_by_customer', 'cancelled_by_admin', 'cancel']
      if (!allowed.includes(toStatus)) {
        throw new Error(`انتقال وضعیت از '${fromStatus}' به '${toStatus}' مجاز نیست.`)
      }
    }

    // Allowed transitions from approve:
    // approve -> completed | cancelled_by_admin (staff cancellation before delivery)
    if (fromStatus === 'approve') {
      const allowed = ['approve', 'completed', 'cancelled_by_admin']
      if (!allowed.includes(toStatus)) {
        throw new Error(`انتقال وضعیت از حواله صادرشده (${fromStatus}) به ${toStatus} مجاز نیست.`)
      }
    }

    // If status changed, record timeline entry
    if (toStatus !== fromStatus) {
      const existingTimeline = Array.isArray(originalDoc.timeline) ? originalDoc.timeline : []
      const newEntry = {
        timestamp: new Date().toISOString(),
        status: toStatus,
      }
      data.timeline = [...existingTimeline, newEntry]
    }
  }

  return data
}
