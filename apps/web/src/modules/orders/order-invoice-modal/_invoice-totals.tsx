import { formatToman } from "@/lib/utils/currency"

interface InvoiceTotalsProps {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  finalTotal: number;
}

export function InvoiceTotals({ subtotal, discountAmount, taxAmount, finalTotal }: InvoiceTotalsProps) {
  return (
      <div className="w-full flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-5">
        <div className="w-full bg-default-100 rounded-xl sm:rounded-2xl text-xs overflow-hidden print:text-[9px] print:rounded-xl">
          <div className="p-2.5 sm:p-3 bg-default-200 font-extrabold text-foreground text-xs sm:text-sm print:p-2 print:text-[9px]">
            خلاصه صورت‌حساب مالی
          </div>
          <div className="p-3 sm:p-3.5 space-y-2 sm:space-y-2.5 print:p-2 print:space-y-1.5">
            <div className="flex items-center justify-between text-foreground/80 whitespace-nowrap">
              <span>جمع ناخالص کالاها:</span>
              <span className="font-bold">
                {formatToman(subtotal)} تومان
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-danger pt-0.5 whitespace-nowrap font-bold">
                <span>تخفیف همکار / فاکتور:</span>
                <span>- {formatToman(discountAmount)} تومان</span>
              </div>
            )}

            {taxAmount > 0 && (
              <div className="flex items-center justify-between text-foreground/80 pt-0.5 whitespace-nowrap">
                <span>مالیات ارزش افزوده (۱۰٪):</span>
                <span className="font-bold">
                  {formatToman(taxAmount)} تومان
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-foreground pt-0.5 font-bold whitespace-nowrap">
              <span>مبلغ کل فاکتور:</span>
              <span>{formatToman(finalTotal)} تومان</span>
            </div>

            {/* مبلغ نهایی قابل پرداخت با اپلیکیشن */}
            <div className="flex items-center justify-between bg-foreground text-background p-2.5 sm:p-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm py-2.5 sm:py-3 whitespace-nowrap print:p-2 print:rounded-lg print:text-[9px]">
              <span>مبلغ نهایی قابل پرداخت:</span>
              <span className="text-xs sm:text-sm">
                {formatToman(finalTotal)} تومان
              </span>
            </div>
          </div>
        </div>
      </div>
  );
}
