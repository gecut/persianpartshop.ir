import { formatTrackingNumber } from '@/lib/utils/tracking-number'
import { useSubmitOrder } from "@/modules/orders/use-submit-order";
import { useTextDraft } from '@/lib/drafts'
import { customerErrorMessage } from '@/lib/utils/error'
import { selectionStore } from '@/modules/products/selection-store'
import { WarehouseSummary } from '@/modules/cart/warehouse-selection'
import { useRef, useState, useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { Button } from '@heroui/react'
import { useCart } from '@/modules/cart/cart-store'
import { CartItemRow } from '@/modules/cart/cart-item-row'

import { useAuth } from '@/modules/auth/auth-store'
import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { toast } from '@/components/feedback/toast'
import { Modal } from '@/components/ui/modal'
import {
  ShoppingCartIcon,
  Trash2Icon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  StoreIcon,
  MapPinIcon,
  TomanIcon,
} from '@/components/ui/icons'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

function CartPage() {
  const navigate = useNavigate()
  const {
    items,
    warehouse,
    itemCount,
    quantitySummary,
    subtotal,
    discountAmount,
    finalTotal,
    hasBlockingIssues,
    clearCart,
  } = useCart()

  const { user, isAuthenticated } = useAuth()
  const isOrderingDisabled = Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock)

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [orderNotes, setOrderNotes, discardNotes] = useTextDraft<string>(user?.id ?? '', 'cart-notes', '')
  const idempotencyKeyRef = useRef<string | null>(null)

  const submitOrderMutation = useSubmitOrder();

  const isSubmitting = submitOrderMutation.isPending
  const entryChecked = useRef(false)
  useEffect(() => {
    if (!items.length || entryChecked.current) return
    entryChecked.current = true
    void selectionStore.revalidate()
  }, [items.length])

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
      setIsCheckoutModalOpen(false)
      toast.success(
        'سفارش با موفقیت در سامانه ثبت گردید',
        `شماره پیگیری: ${formatTrackingNumber(newOrder.orderNumber)}`
      )
      navigate({ to: '/orders/$id', params: { id: String(newOrder.id) } })
    } catch (err) {
      toast.error('خطا در ثبت سفارش', customerErrorMessage(err, 'پاسخ دریافت نشد و ممکن است سفارش ثبت شده باشد؛ سفارش‌ها را بررسی کنید یا با همین سبد دوباره تلاش کنید.'))
    }
  }

  return (
    <div className="w-full px-3 py-3 space-y-3">
      <WarehouseSummary />
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5">
            <ShoppingCartIcon size={20} className="text-primary" />
            <span>سبد خرید</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            بررسی اقلام و تکمیل سفارش
          </p>
        </div>

        {items.length > 0 && (
          <Button
            type="button"
            onPress={() => { clearCart(); setOrderNotes(''); discardNotes() }}
            className="text-xs font-semibold text-danger hover:text-danger/80 flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
          >
            <Trash2Icon size={13} />
            <span>خالی کردن</span>
          </Button>
        )}
      </div>

      {/* Main Cart Content */}
      {items.length === 0 ? (
        <div className="bg-muted/5 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
            <ShoppingCartIcon size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              سبد خرید خالی است
            </h3>
            <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">
              برای مشاهده و انتخاب کالاها به لیست محصولات مراجعه کنید.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/product"
              className="w-full h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
            >
              مشاهده محصولات
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Cart Items List */}
          <div className="space-y-2">
            {items.map((item) => (
              <CartItemRow key={item.productId} item={item} />
            ))}
          </div>

          {/* Invoice Summary Card */}
          <div className="bg-muted/5 rounded-2xl p-3.5 space-y-2.5">
            <h3 className="text-sm font-bold text-foreground pb-1">
              خلاصه صورت‌حساب
            </h3>

            <div className="space-y-2 text-xs text-muted">
              <div className="flex justify-between">
                <span>تعداد اقلام:</span>
                <span className="font-bold text-foreground">{toPersianDigits(itemCount)} ردیف</span>
              </div>

              <div className="flex justify-between">
                <span>مقدار تحویلی:</span>
                <span className="font-bold text-foreground">{quantitySummary}</span>
              </div>

              <div className="pt-1.5 flex justify-between">
                <span>جمع اقلام:</span>
                <span className="font-bold text-foreground inline-flex items-center gap-1">
                  <span>{formatToman(subtotal)}</span>
                  <TomanIcon className="size-3.5" />
                </span>
              </div>

              <div className="flex justify-between text-success font-bold">
                <span>تخفیف:</span>
                <span className="inline-flex items-center gap-1">
                  <span>- {formatToman(discountAmount)}</span>
                  <TomanIcon className="size-3.5" />
                </span>
              </div>

              <div className="flex justify-between">
                {/* <span>مالیات ارزش افزوده (۱۰٪):</span> */}
                {/* <span className="font-medium text-foreground inline-flex items-center gap-1">
                  <span>{formatToman(taxAmount)}</span>
                  <TomanIcon className="size-3.5" />
                </span> */}
              </div>
            </div>

            <div className="pt-2 flex items-baseline justify-between">
              <span className="text-sm font-bold text-foreground">مبلغ نهایی:</span>
              <span className="text-lg font-bold text-primary inline-flex items-center gap-1">
                <span>{formatToman(finalTotal)}</span>
                <TomanIcon className="size-4" />
              </span>
            </div>

            {hasBlockingIssues && (
              <div className="p-2.5 rounded-2xl bg-danger/15 text-danger text-xs flex items-center gap-1.5">
                <AlertTriangleIcon size={15} className="text-danger shrink-0" />
                <span>کالاهای ناموجود را از سبد حذف کنید.</span>
              </div>
            )}

            {isOrderingDisabled && (
              <div className="p-2.5 rounded-2xl bg-warning/15 text-warning text-xs flex items-center gap-1.5">
                <AlertTriangleIcon size={15} className="text-warning shrink-0" />
                <span>حساب کاربری شما در وضعیت «فقط مشاهده کاتالوگ» تنظیم شده است و امکان ثبت سفارش را ندارد.</span>
              </div>
            )}

            <Button
              type="button"
              onPress={async () => { await selectionStore.revalidate(); const draft = selectionStore.getSnapshot(); if (draft.warehouse && !draft.error && draft.quotes.length === items.length) setIsCheckoutModalOpen(true) }}
              isDisabled={hasBlockingIssues || items.length === 0 || isOrderingDisabled}
              className="w-full h-11 rounded-2xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isOrderingDisabled ? 'ثبت سفارش غیرفعال است (فقط مشاهده)' : 'ادامه ثبت سفارش'}</span>
              {!isOrderingDisabled && <ArrowRightIcon size={15} />}
            </Button>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal (Bottom Sheet on Mobile) */}
      <Modal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        title="تأیید و ثبت سفارش"
        isBottomSheetOnMobile={true}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-muted/10 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <StoreIcon size={16} className="text-primary" />
              <span>{user?.storeName || 'پخش بازرگانی پرشین پارت'}</span>
            </div>
            <div className="flex items-start gap-2 text-muted">
              <MapPinIcon size={16} className="text-muted mt-0.5 shrink-0" />
              <span>{user?.address || 'تهران، بزرگراه فتح، انبار مرکزی'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1 text-start">
              توضیحات سفارش (اختیاری):
            </label>
            <textarea
              rows={2}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="یادداشت یا هماهنگی سفارش..."
              className="w-full p-3 rounded-2xl bg-muted/5 focus:bg-muted/10 text-xs text-foreground transition-all outline-hidden"
            />
          </div>

          <div className="p-3 bg-success/15 rounded-2xl text-xs space-y-1">
            <div className="flex justify-between font-bold text-foreground">
              <span>مبلغ نهایی:</span>
              <span className="text-sm font-bold inline-flex items-center gap-1">
                <span>{formatToman(finalTotal)}</span>
                <TomanIcon className="size-3.5" />
              </span>
            </div>
            <div className="flex justify-between text-success text-xs">
              <span>شیوه پرداخت:</span>
              <span>اعتبار تجاری</span>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-3">
            <Button
              type="button"
              onPress={() => setIsCheckoutModalOpen(false)}
              className="h-10 px-4 rounded-2xl bg-muted/10 text-foreground text-xs font-bold hover:bg-muted/15 transition-colors cursor-pointer"
            >
              بازگشت به سبد
            </Button>
            <Button
              type="button"
              onPress={handleCheckoutSubmit}
              isDisabled={isSubmitting}
              className="h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCwIcon size={16} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2Icon size={16} />
                  <span>ثبت نهایی سفارش</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
