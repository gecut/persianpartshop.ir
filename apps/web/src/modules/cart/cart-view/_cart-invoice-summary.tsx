import { selectionStore } from '@/modules/products/selection-store'

import { Button } from '@heroui/react'

import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { AlertTriangleIcon, ArrowRightIcon, TomanIcon } from '@/components/ui/icons'

interface CartInvoiceSummaryProps {
  itemsLength: number
  itemCount: number
  quantitySummary: string
  subtotal: number
  discountAmount: number
  finalTotal: number
  hasBlockingIssues: boolean
  isOrderingDisabled: boolean
  onOpenCheckout: () => void
}

export function CartInvoiceSummary({
  itemsLength,
  itemCount,
  quantitySummary,
  subtotal,
  discountAmount,
  finalTotal,
  hasBlockingIssues,
  isOrderingDisabled,
  onOpenCheckout,
}: CartInvoiceSummaryProps) {
  return (
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
          onPress={async () => { await selectionStore.revalidate(); const draft = selectionStore.getSnapshot(); if (draft.warehouse && !draft.error && draft.quotes.length === itemsLength) onOpenCheckout() }}
          isDisabled={hasBlockingIssues || itemsLength === 0 || isOrderingDisabled}
          className="w-full control-height-11 bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{isOrderingDisabled ? 'ثبت سفارش غیرفعال است (فقط مشاهده)' : 'ادامه ثبت سفارش'}</span>
          {!isOrderingDisabled && <ArrowRightIcon size={15} />}
        </Button>
      </div>
  );
}
