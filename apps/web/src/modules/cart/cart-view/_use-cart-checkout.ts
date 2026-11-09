import { formatTrackingNumber } from '@/lib/utils/tracking-number'
import { useSubmitOrder } from "@/modules/orders/use-submit-order"
import { customerErrorMessage } from '@/lib/utils/error'
import { selectionStore } from '@/modules/products/selection-store'
import { useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useCart } from '@/modules/cart/cart-store'

import { useAuth } from '@/modules/auth/auth-store'
import { toast } from '@/components/feedback/toast'

interface UseCartCheckoutOptions {
  items: ReturnType<typeof useCart>['items']
  warehouse: ReturnType<typeof useCart>['warehouse']
  hasBlockingIssues: boolean
  user: ReturnType<typeof useAuth>['user']
  isAuthenticated: boolean
  orderNotes: string
  discardNotes: () => void
  onSubmitted: () => void
}

export function useCartCheckout({
  items,
  warehouse,
  hasBlockingIssues,
  user,
  isAuthenticated,
  orderNotes,
  discardNotes,
  onSubmitted,
}: UseCartCheckoutOptions) {
  const navigate = useNavigate()
  const idempotencyKeyRef = useRef<string | null>(null)
  const submitOrderMutation = useSubmitOrder();
  const isSubmitting = submitOrderMutation.isPending

  const handleCheckoutSubmit = async () => {
    if (!isAuthenticated || !user) {
      toast.warning('نیاز به ورود', 'لطفاً ابتدا وارد حساب کاربری شوید.')
      navigate({ to: '/login' })
      return
    }

    if (items.length === 0 || hasBlockingIssues || !warehouse) {
      toast.error('خطای ثبت سفارش', 'امکان ثبت سفارش با اقلام ناموجود یا سبد خالی وجود ندارد.')
      return
    }

    try {
      idempotencyKeyRef.current = selectionStore.submissionKey(orderNotes || '')
      const orderPayload = {
        warehouseId: warehouse!.id,
        items: items.map((i) => ({
          productId: i.productId,
          requestedArea: i.requestedArea || i.deliverableArea || 1,
        })),
        notes: orderNotes || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      }

      const submittedDraft = selectionStore.submissionSnapshot()
      const newOrder = await submitOrderMutation.mutateAsync(orderPayload)
      idempotencyKeyRef.current = null

      if (!selectionStore.finishSubmission(submittedDraft)) return
      discardNotes()
      onSubmitted()
      toast.success(
        'سفارش با موفقیت در سامانه ثبت گردید',
        `شماره پیگیری: ${formatTrackingNumber(newOrder.orderNumber)}`
      )
      navigate({ to: '/orders/$id', params: { id: String(newOrder.id) } })
    } catch (err) {
      toast.error('خطا در ثبت سفارش', customerErrorMessage(err, 'پاسخ دریافت نشد و ممکن است سفارش ثبت شده باشد؛ سفارش‌ها را بررسی کنید یا با همین سبد دوباره تلاش کنید.'))
    }
  }

  return { handleCheckoutSubmit, isSubmitting }
}
