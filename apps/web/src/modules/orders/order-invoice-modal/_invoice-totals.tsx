import { formatToman } from '@/lib/utils/currency'
import { tomanToPersianWords } from './_invoice-format'

interface InvoiceTotalsProps {
  subtotal: number
  discountAmount: number
  taxAmount: number
  finalTotal: number
}

export function InvoiceTotals({ subtotal, discountAmount, taxAmount, finalTotal }: InvoiceTotalsProps) {
  return (
    <div className="w-full flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-5">
      <div className="w-full bg-default-100 rounded-xl sm:rounded-2xl text-xs overflow-hidden print:text-[9px] print:rounded-xl">
        <div className="p-3 sm:p-3.5 space-y-2 sm:space-y-2.5 print:p-2 print:space-y-1.5">
          {(discountAmount > 0 || taxAmount > 0) && (
            <>
              <div className="flex items-center justify-between text-foreground/80 whitespace-nowrap">
                <span>جمع کالاها:</span>
                <span className="font-bold">{formatToman(subtotal)} تومان</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-danger pt-0.5 whitespace-nowrap font-bold">
                  <span>تخفیف:</span>
                  <span>- {formatToman(discountAmount)} تومان</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex items-center justify-between text-foreground/80 pt-0.5 whitespace-nowrap">
                  <span>مالیات بر ارزش افزوده:</span>
                  <span className="font-bold">{formatToman(taxAmount)} تومان</span>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between border-2 border-foreground rounded-xl px-3 py-2 font-extrabold text-xs sm:text-sm whitespace-nowrap print:text-[9px]">
            <span>مبلغ قابل پرداخت:</span>
            <span>{formatToman(finalTotal)} تومان</span>
          </div>

          <p className="text-[11px] text-muted print:text-[8.5px]">
            به حروف: {tomanToPersianWords(Math.round(finalTotal))}
          </p>
        </div>
      </div>
    </div>
  )
}
